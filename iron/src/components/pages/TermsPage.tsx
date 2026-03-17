import { motion } from 'framer-motion';

export default function TermsPage() {
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
            <h1 className="text-4xl font-black uppercase italic">Terms of Service</h1>
            <p className="text-gray-500 text-sm mt-2">Last updated: January 2026</p>
          </div>

          {[
            {
              title: '1. Acceptance of Terms',
              body: 'By creating an account and using IronBuddy, you agree to these Terms of Service. If you do not agree, do not use the application.',
            },
            {
              title: '2. Description of Service',
              body: 'IronBuddy is an AI-powered fitness and nutrition application that provides personalised workout plans, meal suggestions, and coaching advice. All AI-generated content is for informational and motivational purposes only.',
            },
            {
              title: '3. User Responsibilities',
              body: 'You are responsible for maintaining the confidentiality of your account credentials. You agree not to use the service for any unlawful purpose, to submit false information, or to impersonate another person. You must be at least 18 years old, or have parental consent, to use IronBuddy.',
            },
            {
              title: '4. Health & Medical Disclaimer',
              body: 'IronBuddy does not provide medical advice. All content, including AI-generated workout plans, meal plans, and coaching responses, is for informational purposes only and is not a substitute for professional medical, nutritional, or fitness guidance. Always consult a qualified healthcare professional before beginning any exercise or diet programme, particularly if you have existing health conditions.',
            },
            {
              title: '5. Limitation of Liability',
              body: 'To the fullest extent permitted by law, IronBuddy and its developers shall not be liable for any injury, illness, loss, or damage arising directly or indirectly from your use of the application or its AI-generated content. Use the application at your own risk.',
            },
            {
              title: '6. Intellectual Property',
              body: 'All content, design, and code within IronBuddy is the intellectual property of its creators. You may not copy, reproduce, or distribute any part of the application without prior written permission.',
            },
            {
              title: '7. Account Termination',
              body: 'We reserve the right to suspend or terminate your account at any time if we reasonably believe you are violating these terms. You may delete your account at any time from within Settings.',
            },
            {
              title: '8. Changes to Terms',
              body: 'We may update these terms from time to time. Continued use of the application after changes are posted constitutes acceptance of the revised terms.',
            },
            {
              title: '9. Contact',
              body: 'For questions about these terms, please use the Contact page within the application.',
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
