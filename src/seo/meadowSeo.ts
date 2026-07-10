export const MEADOW_CANONICAL_URL = 'https://booster.storytailor.com'

export const MEADOW_TITLE = "Booster's Meadow"

export const MEADOW_DESCRIPTION =
  'A quiet meadow refuge from Storytailor. Wander with Booster through a calm cosmic moment, then press start when you are ready.'

export const MEADOW_OG_IMAGE_URL = `${MEADOW_CANONICAL_URL}/seo-image.jpg`

export const MEADOW_OG_IMAGE_WIDTH = 2400

export const MEADOW_OG_IMAGE_HEIGHT = 1260

export const MEADOW_OG_SITE_NAME = 'Storytailor'

export const MEADOW_THEME_COLOR = '#0A0D14'

export const MEADOW_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: MEADOW_TITLE,
  url: MEADOW_CANONICAL_URL,
  description: MEADOW_DESCRIPTION,
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Storytailor Inc.',
    url: 'https://storytailor.com',
  },
  image: MEADOW_OG_IMAGE_URL,
} as const
