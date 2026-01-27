'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Film, Users, Sparkles, Clock, ArrowRight, Zap, User, UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

const features = [
  {
    icon: Users,
    title: 'Group Decisions',
    description: 'Everyone swipes, AI finds the perfect match for your group',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered',
    description: 'Smart recommendations based on your combined mood and preferences',
  },
  {
    icon: Clock,
    title: '5-Minute Decision',
    description: 'No more endless scrolling. Pick a movie in under 5 minutes',
  },
  {
    icon: Zap,
    title: 'Real-time Sync',
    description: 'See who liked what as everyone swipes together',
  },
];

const steps = [
  { step: 1, title: 'Create Session', description: 'Start a room and share the code' },
  { step: 2, title: 'Set the Mood', description: "Tell AI what you're feeling tonight" },
  { step: 3, title: 'Swipe Together', description: 'Everyone swipes on AI-picked movies' },
  { step: 4, title: 'Match & Watch', description: 'Instant notification when you all agree' },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-32">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl">
                <Film className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold gradient-text">CineMatch</h1>
            </div>

            {/* Tagline */}
            <h2 className="text-4xl sm:text-6xl font-bold text-white mb-6 leading-tight">
              Group Movie Decisions
              <br />
              <span className="gradient-text">Made Easy</span>
            </h2>

            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Stop wasting time debating what to watch. Swipe together, let AI mediate,
              and find the perfect movie in under 5 minutes.
            </p>

            {/* CTA Buttons - Three Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {/* Solo Mode */}
              <motion.button
                onClick={() => router.push('/solo')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group p-6 bg-gray-800/50 border border-gray-700 rounded-2xl hover:border-primary-500/50 hover:bg-gray-800 transition-all text-left"
              >
                <div className="p-3 bg-primary-500/20 rounded-xl w-fit mb-3 group-hover:bg-primary-500/30 transition-colors">
                  <User className="w-6 h-6 text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Just Me</h3>
                <p className="text-sm text-gray-400">Get personal recommendations</p>
              </motion.button>

              {/* Create Group */}
              <motion.button
                onClick={() => router.push('/session/create')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group p-6 bg-gradient-to-br from-primary-500/20 to-accent-500/20 border border-primary-500/30 rounded-2xl hover:border-primary-500/50 transition-all text-left"
              >
                <div className="p-3 bg-primary-500/30 rounded-xl w-fit mb-3 group-hover:bg-primary-500/40 transition-colors">
                  <UserPlus className="w-6 h-6 text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Create Group</h3>
                <p className="text-sm text-gray-400">Start a session & invite friends</p>
              </motion.button>

              {/* Join Group */}
              <motion.button
                onClick={() => router.push('/session/join')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group p-6 bg-gray-800/50 border border-gray-700 rounded-2xl hover:border-primary-500/50 hover:bg-gray-800 transition-all text-left"
              >
                <div className="p-3 bg-gray-700 rounded-xl w-fit mb-3 group-hover:bg-gray-600 transition-colors">
                  <Users className="w-6 h-6 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Join Group</h3>
                <p className="text-sm text-gray-400">Enter a session code</p>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h3 className="text-3xl font-bold text-white mb-4">
              Why CineMatch?
            </h3>
            <p className="text-gray-400 max-w-2xl mx-auto">
              We combine the fun of Tinder-style swiping with AI-powered recommendations
              to end the &quot;what should we watch?&quot; debate forever.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card variant="gradient" padding="lg" className="h-full">
                  <div className="p-3 bg-primary-500/20 rounded-xl w-fit mb-4">
                    <feature.icon className="w-6 h-6 text-primary-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h4>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h3 className="text-3xl font-bold text-white mb-4">
              How It Works
            </h3>
            <p className="text-gray-400">
              Four simple steps to movie night bliss
            </p>
          </motion.div>

          <div className="space-y-6">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-6"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  {step.step}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white">
                    {step.title}
                  </h4>
                  <p className="text-gray-400 text-sm">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 bg-gradient-to-br from-primary-900/50 to-accent-900/50">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-3xl font-bold text-white mb-4">
              Ready for Movie Night?
            </h3>
            <p className="text-gray-300 mb-8">
              Create a session now and share the code with your friends.
              Movie decisions have never been this easy.
            </p>
            <Button
              size="lg"
              onClick={() => router.push('/session/create')}
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-gray-800">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary-400" />
            <span className="text-gray-400">CineMatch</span>
          </div>
          <p className="text-gray-500 text-sm">
            Built with AI for movie lovers everywhere
          </p>
        </div>
      </footer>
    </div>
  );
}
