export type LegalModalId = 'terms' | 'privacy' | 'research';

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
          'Booster, the characters, artwork, music, and design belong to Storytailor Inc. You may not copy, sell, or redistribute them. The Meadow is built in part on open-source software, credited in Attribution below.',
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
      {
        heading: 'ATTRIBUTION',
        paragraphs: [
          'Built on False Earth by Ming-Jyun Hung, used under the MIT License.',
          'Booster, all characters, artwork, and world design are property of Storytailor Inc.',
          'Original music composed and produced by JQ Sirls.',
        ],
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
    sections: [
      {
        paragraphs: [
          'The meadow is built on a small body of research about attention, play, and breath. It isn\u2019t treatment, and it doesn\u2019t claim to be. It\u2019s a quiet place, designed carefully. These are the ideas behind it.',
        ],
      },
      {
        heading: 'BUSY EYES, QUIETER MIND',
        paragraphs: [
          'When visual attention is absorbed by a rich spatial task, there is less room for looping, intrusive thoughts. Oxford researchers demonstrated this with, of all things, Tetris: absorbing visuospatial play measurably crowded out unwanted imagery. It\u2019s why the meadow gives your eyes grass, wind, and drifting light rather than menus.',
        ],
        citations: [
          {
            label: 'Holmes et al., 2009, PLOS ONE',
            url: 'https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0004153',
          },
          {
            label: 'Iyadurai et al., 2018',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5822451/',
          },
        ],
      },
      {
        heading: 'LOW-STAKES PLAY CALMS THE BODY, NOT JUST THE MOOD',
        paragraphs: [
          'Casual, unpressured games have been shown to reduce physiological stress: heart-rate variability improves, tension drops. Nothing in the meadow can be failed, lost, or done wrong.',
        ],
        citations: [
          {
            label: 'Russoniello, O\u2019Brien & Parks, 2009',
            url: 'https://doi.org/10.3233/978-1-60750-017-9-189',
          },
        ],
      },
      {
        heading: 'VIVID IMAGERY BEATS COUNTING SHEEP',
        paragraphs: [
          'People told to simply count fell asleep no faster than people told to do nothing; people who imagined an engaging, pleasant scene settled sooner. That\u2019s why the orbs drift and glow instead of stacking into a score.',
        ],
        citations: [
          {
            label: 'Harvey & Payne, 2002',
            url: 'https://doi.org/10.1016/s0005-7967(01)00012-2',
          },
        ],
      },
      {
        heading: 'GENTLE, REPETITIVE PLAY LIFTS MOOD QUICKLY',
        paragraphs: [
          'A recent Oxford study of a famously calm game found mood rises during play, with most of the benefit arriving in the first fifteen minutes. A short visit is enough; the meadow doesn\u2019t ask for more.',
        ],
        citations: [
          {
            label: 'University of Oxford, 2024',
            url: 'https://www.ox.ac.uk/news/2024-09-25-new-study-reveals-positive-mood-changes-during-video-game-play',
          },
        ],
      },
      {
        heading: 'SIX BREATHS A MINUTE',
        paragraphs: [
          'Breathing slowly, around six breaths per minute, reliably settles the nervous system. The orbs brighten and dim at that pace. If you find yourself breathing with them, that\u2019s the design working.',
        ],
        citations: [
          {
            label: 'Lehrer & Gevirtz, 2014, Frontiers in Psychology',
            url: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00756/full',
          },
        ],
      },
      {
        heading: 'NO STREAKS, NO SCORES, NOTHING OWED',
        paragraphs: [
          'Decades of motivation research show that pressure and external rewards crowd out the quiet, self-chosen kind of engagement. So the count fades, nothing persists between visits, and the meadow never asks you to come back.',
        ],
        citations: [
          {
            label: 'Ryan & Deci, 2000',
            url: 'https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf',
          },
        ],
      },
      {
        paragraphs: ['That\u2019s the whole design. Stay as long as you like.'],
      },
    ],
  },
};
