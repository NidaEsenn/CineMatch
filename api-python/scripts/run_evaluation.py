#!/usr/bin/env python3
"""
CineMatch Evaluation Runner

Bu script, öneri sisteminin kalitesini test eder ve sonuçları raporlar.

Kullanım:
    cd api-python
    python -m scripts.run_evaluation

    # Veya doğrudan:
    python scripts/run_evaluation.py

Çıktı:
    - Terminal'de renkli sonuçlar
    - evaluation_results.json dosyası
"""

import sys
import os
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.embeddings import EmbeddingEngine
from ml.group_fairness import FairGroupRecommender
from ml.evaluation import RecommendationEvaluator


def main():
    """Ana evaluation fonksiyonu"""

    print("\n🎬 CineMatch Evaluation Pipeline Starting...")
    print("-" * 50)

    # Initialize components
    print("\n📦 Initializing components...")

    try:
        print("  → Loading EmbeddingEngine...")
        embedding_engine = EmbeddingEngine()
        print(f"  ✅ EmbeddingEngine loaded")

        print("  → Creating FairGroupRecommender...")
        fair_recommender = FairGroupRecommender(embedding_engine)
        print(f"  ✅ FairGroupRecommender ready")

        print("  → Creating RecommendationEvaluator...")
        evaluator = RecommendationEvaluator(fair_recommender)
        print(f"  ✅ RecommendationEvaluator ready")
        print(f"  📊 Loaded metadata for {len(evaluator.metadata)} films")

    except Exception as e:
        print(f"\n❌ Error initializing components: {e}")
        print("\nMake sure you have:")
        print("  1. ChromaDB populated with movie embeddings")
        print("  2. All dependencies installed (pip install -r requirements.txt)")
        sys.exit(1)

    # Run evaluation
    print("\n" + "=" * 50)
    print("🔬 Running Full Evaluation Suite...")
    print("=" * 50)

    try:
        results = evaluator.run_full_evaluation(verbose=True)
    except Exception as e:
        print(f"\n❌ Error running evaluation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # Save results
    output_file = Path(__file__).parent.parent / "evaluation_results.json"

    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False, default=float)

        print(f"\n💾 Results saved to: {output_file}")
    except Exception as e:
        print(f"\n⚠️ Could not save results: {e}")

    # Final summary
    print("\n" + "=" * 50)
    if results['summary']['all_tests_passed']:
        print("🎉 SUCCESS! All evaluation tests passed!")
    else:
        print("⚠️ Some tests did not meet targets. Review results above.")
    print("=" * 50 + "\n")

    return results


def run_quick_test():
    """Hızlı bir test için (debugging amaçlı)"""

    print("\n🔍 Running Quick Test...")

    embedding_engine = EmbeddingEngine()
    fair_recommender = FairGroupRecommender(embedding_engine)
    evaluator = RecommendationEvaluator(fair_recommender)

    # Sadece bir consistency testi
    test_user = [{'name': 'Test', 'moods': ['funny'], 'note': ''}]
    consistency = evaluator.evaluate_consistency(test_user, n_trials=3, top_k=5)

    print(f"\nQuick Consistency Test: {consistency['overlap_ratio']:.1%}")
    print(f"Is Consistent: {consistency['is_consistent']}")

    return consistency


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='CineMatch Evaluation Pipeline')
    parser.add_argument('--quick', action='store_true', help='Run quick test only')
    parser.add_argument('--output', type=str, help='Custom output file path')

    args = parser.parse_args()

    if args.quick:
        run_quick_test()
    else:
        main()
