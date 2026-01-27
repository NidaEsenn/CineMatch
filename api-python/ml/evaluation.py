"""
Evaluation Pipeline for CineMatch Recommendation System

Bu modül, öneri sisteminin kalitesini ölçmek için metrikler hesaplar:
1. Consistency - Tutarlılık (aynı input → aynı output mu?)
2. Genre Alignment - Mood-genre eşleşmesi
3. Diversity - Öneri çeşitliliği
4. Fairness - Grup adaleti

Kullanım:
    evaluator = RecommendationEvaluator(fair_recommender, film_metadata)
    results = evaluator.run_full_evaluation()
"""

import numpy as np
from typing import List, Dict, Optional, TYPE_CHECKING
from collections import Counter
import time

if TYPE_CHECKING:
    from ml.group_fairness import FairGroupRecommender


class RecommendationEvaluator:
    """
    Recommendation system evaluation metrics calculator.

    Dört ana metrik kategorisi:
    - Consistency: Deterministic mi? Aynı input → Aynı output?
    - Genre Alignment: Mood seçimine uygun genre öneriliyor mu?
    - Diversity: Öneriler çeşitli mi? Hep aynı tür film mi?
    - Fairness: Grup önerisinde herkes memnun mu?
    """

    # Mood → Expected genres mapping
    MOOD_GENRE_MAP = {
        'romantic': ['Romance', 'Drama'],
        'funny': ['Comedy'],
        'relaxed': ['Comedy', 'Drama', 'Romance', 'Family'],
        'intense': ['Action', 'Thriller', 'Crime'],
        'thrilling': ['Thriller', 'Action', 'Horror', 'Mystery'],
        'mind-bending': ['Science Fiction', 'Mystery', 'Thriller'],
        'emotional': ['Drama', 'Romance'],
        'adventurous': ['Adventure', 'Action', 'Fantasy'],
        'dark': ['Horror', 'Thriller', 'Crime'],
        'uplifting': ['Comedy', 'Family', 'Animation'],
        'nostalgic': ['Drama', 'Family', 'Romance'],
        'cozy': ['Comedy', 'Romance', 'Family', 'Animation'],
    }

    def __init__(
        self,
        fair_recommender: "FairGroupRecommender",
        film_metadata: Optional[Dict[int, Dict]] = None
    ):
        """
        Args:
            fair_recommender: FairGroupRecommender instance
            film_metadata: {movie_id: {title, genres, year, ...}}
                          Eğer None ise, ChromaDB'den çekilir
        """
        self.recommender = fair_recommender
        self.metadata = film_metadata or {}
        self._load_metadata_from_chroma()

    def _load_metadata_from_chroma(self):
        """ChromaDB'den film metadata'sını yükle"""
        if self.metadata:
            return  # Zaten yüklü

        try:
            # Get all films from ChromaDB
            collection = self.recommender.embedding_engine.vector_store.collection
            results = collection.get(
                include=["metadatas"],
                limit=10000  # Tüm filmleri al
            )

            for i, doc_id in enumerate(results['ids']):
                try:
                    movie_id = int(doc_id)
                    meta = results['metadatas'][i] if results['metadatas'] else {}

                    # Parse genres from string if needed
                    genres = meta.get('genres', [])
                    if isinstance(genres, str):
                        genres = [g.strip() for g in genres.split(',')]

                    self.metadata[movie_id] = {
                        'title': meta.get('title', f'Movie {movie_id}'),
                        'genres': genres,
                        'year': meta.get('year', 2000),
                        'vote_average': meta.get('vote_average', 0),
                    }
                except (ValueError, TypeError):
                    continue

            print(f"[Evaluation] Loaded metadata for {len(self.metadata)} films")
        except Exception as e:
            print(f"[Evaluation] Warning: Could not load metadata from ChromaDB: {e}")

    def evaluate_consistency(
        self,
        test_participants: List[Dict],
        n_trials: int = 5,
        top_k: int = 10
    ) -> Dict:
        """
        Aynı input → Aynı output mu?

        Embedding-based search deterministik olmalı (temperature yok).
        LLM ranking varsa variance olabilir.

        Args:
            test_participants: Test için kullanıcı listesi
            n_trials: Kaç kez tekrarlanacak
            top_k: İlk kaç öneri karşılaştırılacak

        Returns:
            {
                'overlap_ratio': float (0-1),
                'unique_results': int,
                'is_consistent': bool
            }
        """
        all_results = []

        for trial in range(n_trials):
            results = self.recommender.recommend_fair(
                test_participants,
                n_results=top_k
            )
            movie_ids = set([r['movie_id'] for r in results[:top_k]])
            all_results.append(movie_ids)

        # Pairwise Jaccard similarity
        overlaps = []
        for i in range(len(all_results)):
            for j in range(i + 1, len(all_results)):
                intersection = len(all_results[i] & all_results[j])
                union = len(all_results[i] | all_results[j])
                jaccard = intersection / union if union > 0 else 1.0
                overlaps.append(jaccard)

        avg_overlap = np.mean(overlaps) if overlaps else 1.0

        # Unique movie count across all trials
        all_movies = set()
        for result_set in all_results:
            all_movies.update(result_set)

        return {
            'overlap_ratio': float(avg_overlap),
            'unique_results_across_trials': len(all_movies),
            'expected_if_consistent': top_k,
            'is_consistent': avg_overlap > 0.8
        }

    def evaluate_genre_alignment(
        self,
        mood_to_expected_genres: Optional[Dict[str, List[str]]] = None,
        top_k: int = 10
    ) -> Dict[str, Dict]:
        """
        Mood → Beklenen genre çıkıyor mu?

        "romantic" mood seçen birine Romance/Drama filmi önerilmeli.

        Args:
            mood_to_expected_genres: Custom mood-genre mapping
                                   None ise default MOOD_GENRE_MAP kullanılır
            top_k: İlk kaç öneri kontrol edilecek

        Returns:
            {
                'romantic': {'alignment': 0.8, 'matched': 8, 'total': 10, 'is_aligned': True},
                ...
            }
        """
        mapping = mood_to_expected_genres or self.MOOD_GENRE_MAP
        results = {}

        for mood, expected_genres in mapping.items():
            test_participant = [{'name': 'test_user', 'moods': [mood], 'note': ''}]

            try:
                recs = self.recommender.recommend_fair(test_participant, n_results=top_k)
            except Exception as e:
                print(f"[Evaluation] Error getting recommendations for mood '{mood}': {e}")
                results[mood] = {'alignment': 0, 'error': str(e)}
                continue

            matches = 0
            total = 0
            matched_movies = []

            for rec in recs[:top_k]:
                movie_id = rec['movie_id']

                if movie_id not in self.metadata:
                    continue

                film_genres = self.metadata[movie_id].get('genres', [])
                total += 1

                if any(g in film_genres for g in expected_genres):
                    matches += 1
                    matched_movies.append({
                        'id': movie_id,
                        'title': self.metadata[movie_id].get('title'),
                        'genres': film_genres
                    })

            alignment = matches / total if total > 0 else 0

            results[mood] = {
                'alignment': float(alignment),
                'matched': matches,
                'total': total,
                'expected_genres': expected_genres,
                'is_aligned': alignment >= 0.6,
                'sample_matches': matched_movies[:3]  # İlk 3 eşleşme
            }

        return results

    def evaluate_diversity(
        self,
        test_participants: List[Dict],
        top_k: int = 10
    ) -> Dict:
        """
        Öneriler ne kadar çeşitli?

        Metrikler:
        - Unique genre sayısı
        - Genre entropy (dağılım eşitliği)
        - Year spread (farklı yıllardan filmler)

        Args:
            test_participants: Test kullanıcıları
            top_k: İlk kaç öneri

        Returns:
            {
                'unique_genre_count': int,
                'genre_entropy': float,
                'year_spread': float,
                'is_diverse': bool
            }
        """
        recs = self.recommender.recommend_fair(test_participants, n_results=top_k)

        all_genres = []
        years = []

        for rec in recs[:top_k]:
            movie_id = rec['movie_id']

            if movie_id not in self.metadata:
                continue

            film = self.metadata[movie_id]
            genres = film.get('genres', [])
            all_genres.extend(genres)

            year = film.get('year')
            if year:
                try:
                    years.append(int(year))
                except (ValueError, TypeError):
                    pass

        # Unique genres
        unique_genres = list(set(all_genres))
        unique_count = len(unique_genres)

        # Genre entropy (Shannon entropy)
        if all_genres:
            genre_counts = Counter(all_genres)
            total = sum(genre_counts.values())
            probs = [count / total for count in genre_counts.values()]
            entropy = -sum(p * np.log2(p) for p in probs if p > 0)
            max_entropy = np.log2(len(genre_counts)) if len(genre_counts) > 1 else 1
            normalized_entropy = entropy / max_entropy if max_entropy > 0 else 0
        else:
            normalized_entropy = 0

        # Year spread
        year_spread = float(np.std(years)) if len(years) > 1 else 0

        return {
            'unique_genre_count': unique_count,
            'unique_genres': unique_genres,
            'genre_entropy': float(normalized_entropy),
            'year_spread': year_spread,
            'year_range': [min(years), max(years)] if years else [0, 0],
            'is_diverse': unique_count >= 4 and normalized_entropy > 0.5
        }

    def evaluate_fairness(
        self,
        test_participants: List[Dict],
        top_k: int = 10
    ) -> Dict:
        """
        Grup önerisinde fairness metrikleri.

        Least Misery approach kullanıyoruz - en mutsuz kişi
        ne kadar mutsuz olduğunu ölçüyoruz.

        Args:
            test_participants: Grup üyeleri
            top_k: İlk kaç öneri

        Returns:
            {
                'avg_min_score': float,
                'score_variance': float,
                'worst_user': str,
                'best_user': str,
                'user_scores': dict,
                'is_fair': bool
            }
        """
        if len(test_participants) < 2:
            return {
                'avg_min_score': 1.0,
                'score_variance': 0,
                'note': 'Solo user - fairness not applicable',
                'is_fair': True
            }

        recs = self.recommender.recommend_fair(test_participants, n_results=top_k)

        min_scores = []
        all_user_scores = {p['name']: [] for p in test_participants}

        for rec in recs[:top_k]:
            individual = rec.get('individual_scores', {})

            if individual:
                min_scores.append(min(individual.values()))

                for user_name, score in individual.items():
                    if user_name in all_user_scores:
                        all_user_scores[user_name].append(score)

        # User averages
        user_avg_scores = {
            name: float(np.mean(scores)) if scores else 0
            for name, scores in all_user_scores.items()
        }

        # Find worst and best
        sorted_users = sorted(user_avg_scores.items(), key=lambda x: x[1])
        worst_user = sorted_users[0][0] if sorted_users else None
        best_user = sorted_users[-1][0] if sorted_users else None

        avg_min = float(np.mean(min_scores)) if min_scores else 0
        variance = float(np.var(list(user_avg_scores.values()))) if user_avg_scores else 0

        return {
            'avg_min_score': avg_min,
            'score_variance': variance,
            'worst_user': worst_user,
            'worst_user_score': user_avg_scores.get(worst_user, 0),
            'best_user': best_user,
            'best_user_score': user_avg_scores.get(best_user, 0),
            'user_scores': user_avg_scores,
            'is_fair': avg_min > 0.4 and variance < 0.1
        }

    def evaluate_feedback_loop(
        self,
        test_participants: List[Dict],
        n_rounds: int = 3,
        top_k: int = 10
    ) -> Dict:
        """
        Feedback loop'un tekrar önerileri engelleyip engellemediğini ölçer.

        Simülasyon:
        1. İlk round: 10 film öner
        2. Bu filmleri "seen" olarak işaretle (FeedbackLearner simüle)
        3. İkinci round: 10 film daha öner
        4. Overlap kontrol et → 0% olmalı

        Args:
            test_participants: Test kullanıcıları
            n_rounds: Kaç round simüle edilecek
            top_k: Her round kaç film

        Returns:
            {
                'repeat_rate': float (0-1),
                'total_unique': int,
                'total_recommended': int,
                'round_details': [...]
            }
        """
        from ml.feedback_learner import FeedbackLearner

        feedback_learner = FeedbackLearner(self.recommender.embedding_engine)
        session_id = "eval_test_session"

        all_seen = set()
        round_details = []
        total_repeats = 0
        total_recommended = 0

        for round_num in range(1, n_rounds + 1):
            if round_num == 1:
                # İlk round: normal recommendation
                recs = self.recommender.recommend_fair(
                    test_participants, n_results=top_k
                )
            else:
                # Sonraki roundlar: feedback-aware recommendation
                participants_dict = [
                    {"name": p["name"], "moods": p.get("moods", []), "note": p.get("note", "")}
                    for p in test_participants
                ]
                recs = self.recommender.recommend_fair_with_feedback(
                    participants=participants_dict,
                    session_id=session_id,
                    feedback_learner=feedback_learner,
                    n_results=top_k
                )

            movie_ids = set(r['movie_id'] for r in recs[:top_k])
            repeats = movie_ids & all_seen
            new_movies = movie_ids - all_seen

            round_details.append({
                'round': round_num,
                'recommended': len(movie_ids),
                'new': len(new_movies),
                'repeats': len(repeats),
                'repeat_ids': list(repeats)
            })

            total_repeats += len(repeats)
            total_recommended += len(movie_ids)

            # Her filmi "like" olarak kaydet (seen olarak işaretle)
            for mid in movie_ids:
                for p in test_participants:
                    feedback_learner.record_swipe(
                        session_id=session_id,
                        user_name=p['name'],
                        movie_id=mid,
                        action='like'
                    )

            all_seen.update(movie_ids)

        # Temizle
        feedback_learner.clear_session(session_id)

        repeat_rate = total_repeats / total_recommended if total_recommended > 0 else 0

        return {
            'repeat_rate': float(repeat_rate),
            'total_unique': len(all_seen),
            'total_recommended': total_recommended,
            'rounds': n_rounds,
            'is_no_repeat': repeat_rate == 0,
            'round_details': round_details
        }

    def run_full_evaluation(self, verbose: bool = True) -> Dict:
        """
        Tüm metrikleri hesapla.

        Test senaryoları:
        1. Solo user - Tek kişilik öneri
        2. Diverse group - Farklı zevklere sahip 3 kişi
        3. Similar group - Benzer zevklere sahip 2 kişi

        Returns:
            {
                'consistency': {...},
                'genre_alignment': {...},
                'diversity': {...},
                'fairness': {...},
                'summary': {...},
                'timestamp': str
            }
        """
        if verbose:
            print("\n" + "=" * 60)
            print("🎬 CINEMATCH EVALUATION PIPELINE")
            print("=" * 60)

        # Test cases
        solo_user = [
            {'name': 'Solo', 'moods': ['relaxed', 'funny'], 'note': ''}
        ]

        diverse_group = [
            {'name': 'Romantic', 'moods': ['romantic', 'emotional'], 'note': 'love stories'},
            {'name': 'Action', 'moods': ['intense', 'thrilling'], 'note': 'explosions'},
            {'name': 'Comedy', 'moods': ['funny', 'relaxed'], 'note': 'make me laugh'}
        ]

        similar_group = [
            {'name': 'User1', 'moods': ['romantic'], 'note': ''},
            {'name': 'User2', 'moods': ['romantic', 'relaxed'], 'note': 'feel good'},
        ]

        results = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'consistency': {},
            'genre_alignment': {},
            'diversity': {},
            'fairness': {},
            'summary': {}
        }

        # 1. Consistency
        if verbose:
            print("\n📊 Testing CONSISTENCY...")

        results['consistency'] = {
            'solo': self.evaluate_consistency(solo_user),
            'diverse_group': self.evaluate_consistency(diverse_group),
            'similar_group': self.evaluate_consistency(similar_group)
        }

        # 2. Genre Alignment
        if verbose:
            print("🎭 Testing GENRE ALIGNMENT...")

        results['genre_alignment'] = self.evaluate_genre_alignment()

        # 3. Diversity
        if verbose:
            print("🌈 Testing DIVERSITY...")

        results['diversity'] = {
            'solo': self.evaluate_diversity(solo_user),
            'diverse_group': self.evaluate_diversity(diverse_group)
        }

        # 4. Fairness
        if verbose:
            print("⚖️ Testing FAIRNESS...")

        results['fairness'] = {
            'diverse_group': self.evaluate_fairness(diverse_group),
            'similar_group': self.evaluate_fairness(similar_group)
        }

        # 5. Feedback Loop (repeat prevention)
        if verbose:
            print("🔄 Testing FEEDBACK LOOP...")

        results['feedback_loop'] = {
            'solo': self.evaluate_feedback_loop(solo_user, n_rounds=3),
            'diverse_group': self.evaluate_feedback_loop(diverse_group, n_rounds=3)
        }

        # Summary
        consistency_scores = [
            results['consistency'][k]['overlap_ratio']
            for k in results['consistency']
        ]

        alignment_scores = [
            results['genre_alignment'][k]['alignment']
            for k in results['genre_alignment']
            if 'alignment' in results['genre_alignment'][k]
        ]

        feedback_repeat_rates = [
            results['feedback_loop'][k]['repeat_rate']
            for k in results['feedback_loop']
        ]

        results['summary'] = {
            'avg_consistency': float(np.mean(consistency_scores)),
            'avg_genre_alignment': float(np.mean(alignment_scores)) if alignment_scores else 0,
            'diverse_group_fairness': results['fairness']['diverse_group']['avg_min_score'],
            'diverse_group_diversity': results['diversity']['diverse_group']['unique_genre_count'],
            'feedback_repeat_rate': float(np.mean(feedback_repeat_rates)),
            'all_tests_passed': all([
                np.mean(consistency_scores) > 0.8,
                np.mean(alignment_scores) > 0.6 if alignment_scores else True,
                results['fairness']['diverse_group']['avg_min_score'] > 0.4,
                results['diversity']['diverse_group']['unique_genre_count'] >= 4,
                all(r == 0 for r in feedback_repeat_rates)
            ])
        }

        if verbose:
            self._print_results(results)

        return results

    def _print_results(self, results: Dict):
        """Sonuçları güzel formatta yazdır"""
        print("\n" + "=" * 60)
        print("📈 EVALUATION RESULTS")
        print("=" * 60)

        # Consistency
        print("\n📊 CONSISTENCY (Target: >80%)")
        for case, data in results['consistency'].items():
            score = data['overlap_ratio']
            status = "✅" if score > 0.8 else "⚠️" if score > 0.5 else "❌"
            print(f"  {case:20} {score:6.1%} {status}")

        # Genre Alignment
        print("\n🎭 GENRE ALIGNMENT (Target: >60%)")
        for mood, data in results['genre_alignment'].items():
            if 'alignment' in data:
                score = data['alignment']
                status = "✅" if score > 0.6 else "⚠️" if score > 0.4 else "❌"
                print(f"  {mood:20} {score:6.1%} {status}")

        # Diversity
        print("\n🌈 DIVERSITY (Target: 4+ genres)")
        for case, data in results['diversity'].items():
            count = data['unique_genre_count']
            entropy = data['genre_entropy']
            status = "✅" if count >= 4 else "⚠️" if count >= 2 else "❌"
            print(f"  {case:20} {count} genres, entropy={entropy:.2f} {status}")

        # Fairness
        print("\n⚖️ FAIRNESS (Target: avg_min > 0.4)")
        for case, data in results['fairness'].items():
            if 'avg_min_score' in data:
                score = data['avg_min_score']
                variance = data.get('score_variance', 0)
                status = "✅" if score > 0.4 else "⚠️" if score > 0.2 else "❌"
                print(f"  {case:20} avg_min={score:.3f}, var={variance:.4f} {status}")
                if 'user_scores' in data:
                    for user, user_score in data['user_scores'].items():
                        print(f"    └─ {user}: {user_score:.3f}")

        # Feedback Loop
        print("\n🔄 FEEDBACK LOOP (Target: 0% repeats)")
        for case, data in results.get('feedback_loop', {}).items():
            rate = data['repeat_rate']
            total = data['total_unique']
            rounds = data['rounds']
            status = "✅" if rate == 0 else "❌"
            print(f"  {case:20} {rate:6.1%} repeat rate, {total} unique across {rounds} rounds {status}")
            for rd in data['round_details']:
                print(f"    └─ Round {rd['round']}: {rd['new']} new, {rd['repeats']} repeats")

        # Summary
        print("\n" + "=" * 60)
        summary = results['summary']
        overall = "✅ ALL TESTS PASSED" if summary['all_tests_passed'] else "⚠️ SOME TESTS FAILED"
        print(f"📋 SUMMARY: {overall}")
        print(f"   Avg Consistency:     {summary['avg_consistency']:.1%}")
        print(f"   Avg Genre Alignment: {summary['avg_genre_alignment']:.1%}")
        print(f"   Fairness Score:      {summary['diverse_group_fairness']:.3f}")
        print(f"   Diversity:           {summary['diverse_group_diversity']} genres")
        print(f"   Repeat Rate:         {summary['feedback_repeat_rate']:.1%}")
        print("=" * 60)
