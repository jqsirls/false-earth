export type LegalModalId = 'credits' | 'terms' | 'privacy';

export type LegalModalSection = {
  heading?: string;
  paragraphs: string[];
};

export type LegalModalContent = {
  id: LegalModalId;
  title: string;
  lastUpdated?: string;
  sections: LegalModalSection[];
};

export const LEGAL_MODAL_CONTENT: Record<LegalModalId, LegalModalContent> = {
  credits: {
    id: 'credits',
    title: 'CREDITS',
    sections: [
      {
        paragraphs: [
          'Built on False Earth by Ming-Jyun Hung, used under the MIT License.',
          'Booster, all characters, artwork, and world design are property of Storytailor Inc.',
          'Original music composed and produced by JQ Sirls.',
        ],
      },
    ],
  },
  terms: {
    id: 'terms',
    title: 'TERMS OF USE',
    lastUpdated: 'July 2026',
    sections: [
      {
        paragraphs: [
          'Storytailor® is a registered trademark of Storytailor Inc. Booster™ and the Booster character are property of Storytailor Inc.',
        ],
      },
      {
        heading: 'WHAT THIS IS',
        paragraphs: [
          "Booster's Meadow is a calm space made by Storytailor Inc. It is free, and no account is needed to use it.",
        ],
      },
      {
        heading: 'ACCOUNTS',
        paragraphs: [
          'If you connect smart lights or make a story, you will sign in with or create a free Storytailor account. Your account is governed by the Storytailor Terms of Service at storytailor.com/terms, which apply here too. Accounts are for adults. If a child uses the Meadow, a parent or guardian holds the account.',
        ],
      },
      {
        heading: 'SMART LIGHTS',
        paragraphs: [
          'Connecting Philips Hue is optional. You can disconnect at any time from the lamp menu. Light effects are designed to change slowly, but you know your household best; if anyone in your home is sensitive to changing light, use the reduced lighting setting or keep lights disconnected.',
        ],
      },
      {
        heading: 'OURS AND YOURS',
        paragraphs: [
          'Booster, the characters, artwork, music, and design belong to Storytailor Inc. You may not copy, sell, or redistribute them. The Meadow is built in part on open-source software, credited in Credits.',
        ],
      },
      {
        heading: 'BE KIND TO THE MEADOW',
        paragraphs: [
          'Do not attempt to disrupt, reverse engineer, scrape, or misuse the experience or its services.',
        ],
      },
      {
        heading: 'NO PROMISES',
        paragraphs: [
          'The Meadow is provided as is. It is a place to rest, not a medical device, and it is not a substitute for professional care.',
        ],
      },
      {
        heading: 'CHANGES',
        paragraphs: [
          'We may update the Meadow and these terms. If we make meaningful changes, we will update the date above.',
        ],
      },
      {
        heading: 'QUESTIONS',
        paragraphs: ['hello@storytailor.com'],
      },
    ],
  },
  privacy: {
    id: 'privacy',
    title: 'PRIVACY',
    lastUpdated: 'July 2026',
    sections: [
      {
        paragraphs: ['The Meadow is built to ask for as little as possible.'],
      },
      {
        heading: 'WITHOUT AN ACCOUNT',
        paragraphs: [
          'We collect basic, anonymous usage information (visits, session length, device type) to keep the Meadow working well. That\'s it.',
        ],
      },
      {
        heading: 'WITH AN ACCOUNT',
        paragraphs: [
          'If you sign in or create a Storytailor account, we store your email and account details under the Storytailor Privacy Policy at storytailor.com/privacy.',
        ],
      },
      {
        heading: 'SMART LIGHTS',
        paragraphs: [
          'If you connect Philips Hue, we store the connection securely so your lights work next visit. We never see or control your lights outside the Meadow, and you can disconnect and delete the connection anytime from the lamp menu.',
        ],
      },
      {
        heading: 'CHILDREN',
        paragraphs: [
          'The Meadow collects no information about children. Ever. Accounts belong to adults.',
        ],
      },
      {
        heading: 'WE NEVER SELL YOUR DATA',
        paragraphs: ['No ads, no data sales, no exceptions.'],
      },
      {
        heading: 'QUESTIONS OR DELETION REQUESTS',
        paragraphs: ['hello@storytailor.com'],
      },
    ],
  },
};
