import { motion } from 'framer-motion';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[--color-gym-dark] text-white pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div>
            <p className="text-[--color-iron-gold] text-[10px] font-black tracking-[0.35em] uppercase opacity-70 mb-2">Legal</p>
            <h1 className="text-4xl font-black uppercase italic">Privacy Policy</h1>
            <p className="text-gray-500 text-sm mt-2">Last updated: January 2026</p>
          </div>

          {[
            {
              title: '1. What We Collect',
              body: 'We collect the information you provide when creating an account: your name, email address, and fitness profile (including age, gender, weight, height, fitness goals, and equipment). We also collect usage data such as workout sessions, weight logs, body measurements, and messages sent through the community chat.',
            },
            {
              title: '2. How We Use Your Data',
              body: 'Your data is used to provide and personalise the IronBuddy service — specifically to generate AI workout plans, meal plans, and coaching responses tailored to your profile. We do not sell your personal data to third parties.',
            },
            {
              title: '3. AI Processing',
              body: 'When you interact with the AI Coach or request meal/workout plans, your fitness profile and message content are sent to a third-party AI provider (Groq or Anthropic) to generate a response. These providers process the data under their own privacy policies. We send only the minimum necessary information.',
            },
            {
              title: '4. Data Storage',
              body: 'Your data is stored on our secure server. Profile pictures are stored via our file upload service. Workout data and custom meals are stored in our database. Chat history with the AI Coach is stored locally in your browser (localStorage) and is never sent to our server unless you initiate a new message.',
            },
            {
              title: '5. Data Retention',
              body: 'Your data is retained for as long as your account is active. You can delete your account at any time from Settings → Danger Zone, which permanently removes all your data from our systems.',
            },
            {
              title: '6. Cookies & Local Storage',
              body: 'IronBuddy uses browser localStorage to cache your AI meal plans, workout history, and chat messages locally for performance. No third-party tracking cookies are used.',
            },
            {
              title: '7. Your Rights',
              body: 'You have the right to access, correct, and delete your personal data. You can update your profile in Settings, or delete your account entirely from Settings → Danger Zone. For other data requests, contact us via the Contact page.',
            },
            {
              title: '8. Children\'s Privacy',
              body: 'IronBuddy is not intended for users under 18 years of age. We do not knowingly collect data from children. If you believe a child has created an account, please contact us immediately.',
            },
            {
              title: '9. Changes to This Policy',
              body: 'We may update this Privacy Policy from time to time. We will notify users of significant changes. Continued use of the application after changes constitutes acceptance.',
            },
            {
              title: '10. Contact',
              body: 'For privacy-related questions or data requests, please use the Contact page within the application.',
            },
          ].map(({ title, body }) => (
            <section key={title} className="space-y-2">
              <h2 className="text-base font-black uppercase italic text-[--color-iron-gold]">{title}</h2>
              <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
            </section>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
