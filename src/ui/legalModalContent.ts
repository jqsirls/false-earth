export type LegalModalId = 'credits' | 'terms' | 'privacy' | 'research';

export type LegalModalCitation = {
  label: string;
  url: string;
};

export type LegalModalSection = {
  heading?: string;
  paragraphs: string[];
  citations?: LegalModalCitation[];
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
  research: {
    id: 'research',
    title: 'RESEARCH',
    lastUpdated: 'July 2026',
    sections: [
      {
        paragraphs: [
          'The Meadow looks simple on purpose. Most of its choices — the slow pace, the soft light, the absence of scores — follow published research on how calm spaces, gentle play, and steady breathing help people settle. Here is that research in plain language, with links if you want to go deeper.',
          'The Meadow is a place to rest, not a treatment. If you are struggling, please talk to someone you trust or a professional.',
        ],
      },
      {
        heading: 'A WORLD THAT FILLS YOUR EYES QUIETS THE MIND',
        paragraphs: [
          'When your eyes and hands are gently occupied by a visual task, there is less room for looping, intrusive thoughts. Researchers at Oxford found that visually absorbing games can reduce unwanted mental images. The Meadow is built to be visually absorbing in a soft way — grass, wind, and light that ask for your attention without demanding it.',
        ],
        citations: [
          {
            label: 'Holmes, James, Kilford & Deeprose (2010), PLOS ONE',
            url: 'https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0004153',
          },
          {
            label: 'Iyadurai et al. (2018), Molecular Psychiatry',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5822451/',
          },
        ],
      },
      {
        heading: 'LOW-STAKES PLAY LOWERS STRESS IN THE BODY',
        paragraphs: [
          'Studies of casual games — the kind with nothing to lose — have measured real drops in physiological stress while playing. Nothing in the Meadow can be failed, lost, or done wrong; wandering is the whole game.',
        ],
        citations: [
          {
            label: 'Russoniello, O\u2019Brien & Parks (2009)',
            url: 'https://doi.org/10.3233/978-1-60750-017-9-189',
          },
        ],
      },
      {
        heading: 'GENTLE IMAGERY WORKS BETTER THAN COUNTING SHEEP',
        paragraphs: [
          'People told to imagine a calm, engaging scene fell asleep faster than people told to count or to simply distract themselves. An interesting place settles the mind better than a blank one — which is why the Meadow is a real place, with roses and stars, rather than an empty screen.',
        ],
        citations: [
          {
            label: 'Harvey & Payne (2002), Behaviour Research and Therapy',
            url: 'https://doi.org/10.1016/s0005-7967(01)00012-2',
          },
        ],
      },
      {
        heading: 'A LITTLE GENTLE PLAY LIFTS MOOD QUICKLY',
        paragraphs: [
          'A large Oxford study of a calm, repetitive game found that mood reliably improved during play, with most of the lift arriving in the first fifteen minutes. The Meadow is shaped for exactly that kind of visit: short, unhurried, and complete whenever you choose to leave.',
        ],
        citations: [
          {
            label: 'University of Oxford (2024), PowerWash Simulator study',
            url: 'https://www.ox.ac.uk/news/2024-09-25-new-study-reveals-positive-mood-changes-during-video-game-play',
          },
        ],
      },
      {
        heading: 'SLOW BREATHING CALMS THE NERVOUS SYSTEM',
        paragraphs: [
          'Breathing at around six breaths per minute is one of the best-studied ways to settle the body\u2019s stress response. The glowing orbs drifting through the Meadow brighten and dim at that same slow rhythm — six cycles per minute, a little quicker to brighten and slower to fade. You don\u2019t have to do anything with them. If your breath happens to fall in with their glow, that\u2019s the idea.',
        ],
        citations: [
          {
            label: 'Lehrer & Gevirtz (2014), Frontiers in Psychology',
            url: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00756/full',
          },
        ],
      },
      {
        heading: 'NO PRESSURE IS THE POINT',
        paragraphs: [
          'Decades of research on motivation show that rewards, scores, and streaks can crowd out the quiet enjoyment they were meant to encourage. So the Meadow keeps none of them. Gathering orbs earns nothing and unlocks nothing; the count fades away and resets every visit. What remains is the reason to be here at all: because it feels good to be.',
        ],
        citations: [
          {
            label: 'Ryan & Deci (2000), Self-Determination Theory',
            url: 'https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf',
          },
        ],
      },
    ],
  },
};
