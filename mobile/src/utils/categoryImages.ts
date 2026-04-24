const images: Record<string, any> = {
  'arts-crafts': require('../assets/images/arts-crafts.jpg'),
  biking: require('../assets/images/biking.jpg'),
  'coffee-meets': require('../assets/images/coffee-meets.jpg'),
  community: require('../assets/images/community.jpg'),
  cooking: require('../assets/images/cooking.jpg'),
  gardening: require('../assets/images/gardening.jpg'),
  hiking: require('../assets/images/hiking.jpg'),
  running: require('../assets/images/running.jpg'),
  social: require('../assets/images/social.jpg'),
  tennis: require('../assets/images/tennis.jpg'),
  wellness: require('../assets/images/wellness.jpg'),
  yoga: require('../assets/images/yoga.jpg'),
};

const categoryMap: Record<string, any> = {
  // Sports & Fitness
  tennis: images.tennis,
  pickleball: images.tennis,
  badminton: images.tennis,
  'sports & fitness': images.running,
  running: images.running,
  cycling: images.biking,
  biking: images.biking,
  hiking: images.hiking,
  'adventure & outdoors': images.hiking,
  climbing: images.hiking,
  yoga: images.yoga,
  wellness: images.wellness,
  meditation: images.wellness,
  fitness: images.running,

  // Food & Social
  cooking: images.cooking,
  food: images.cooking,
  'food & social': images.cooking,
  'food & drink': images.cooking,
  coffee: images['coffee-meets'],
  'coffee & chat': images['coffee-meets'],
  drinks: images['coffee-meets'],

  // Creative
  arts: images['arts-crafts'],
  crafts: images['arts-crafts'],
  'arts & crafts': images['arts-crafts'],
  creative: images['arts-crafts'],
  art: images['arts-crafts'],

  // Community
  community: images.community,
  volunteering: images.community,
  campus: images.community,
  professional: images.social,
  networking: images.social,
  social: images.social,

  // Lifestyle & Nature
  gardening: images.gardening,
  nature: images.gardening,
  lifestyle: images.wellness,
};

export function getFallbackImage(category?: string | null): any {
  if (!category) return images.community;
  const key = category.toLowerCase().trim();
  if (categoryMap[key]) return categoryMap[key];
  for (const [mapKey, img] of Object.entries(categoryMap)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return img;
  }
  return images.community;
}
