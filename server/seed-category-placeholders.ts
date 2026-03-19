import { db } from "./db";
import { categoryPlaceholders, categories } from "@shared/schema";

interface PlaceholderSet {
  name: string;
  tagline: string;
  description: string;
}

interface CategoryPlaceholders {
  categoryName: string;
  placeholders: PlaceholderSet[];
}

const placeholderData: CategoryPlaceholders[] = [
  // ── Food & Social ──────────────────────────────────────────────────────────
  {
    categoryName: "dining_out",
    placeholders: [
      { name: "Flavor Explorers", tagline: "Taste the best spots in town", description: "Restaurant reviews, food crawls, and tasting events for anyone who loves discovering new flavors." },
      { name: "Fork & Find", tagline: "Your next favorite restaurant awaits", description: "Uncover hidden gems, share reviews, and organize group dinners at the best local spots." },
      { name: "The Hungry Collective", tagline: "Good food is better shared", description: "A community of food lovers discovering restaurants, rating dishes, and eating out together." },
      { name: "Table for Many", tagline: "Every meal is an adventure", description: "Group dining outings, restaurant recommendations, and food-centric social events near you." },
      { name: "Plate Chasers", tagline: "Always on the hunt for great food", description: "Share your favorite finds, plan foodie outings, and never eat alone again." },
      { name: "The Dining Circle", tagline: "Where great food meets great company", description: "Explore new cuisines, join group dinners, and build friendships over memorable meals." },
      { name: "Local Bites Club", tagline: "Eat local, discover more", description: "A guide to the best local eats—organized dinners, tastings, and food walks nearby." },
      { name: "The Reservation", tagline: "Your table is waiting", description: "Reserve your spot at group dining events and discover the best restaurants in the area." },
      { name: "Dine & Shine", tagline: "Fine food, fine people", description: "Elevated dining experiences and casual eats with people who share your passion for food." },
      { name: "Open Table Crew", tagline: "More seats, more fun", description: "Organize group restaurant outings, share menus, and make every meal a social event." },
    ],
  },
  {
    categoryName: "coffee_meetups",
    placeholders: [
      { name: "Morning Brew Club", tagline: "Connecting over great coffee", description: "Casual meetups at local cafés to chat, network, and discover the best brews in town." },
      { name: "The Grind Gang", tagline: "Life begins after coffee", description: "Coffee shop crawls, latte art appreciation, and morning meetups for caffeine enthusiasts." },
      { name: "Pour Over Pals", tagline: "Sip, chat, repeat", description: "Connect with fellow coffee lovers over the best local brews and cozy café vibes." },
      { name: "Caffeine Collective", tagline: "Better coffee, better mornings", description: "Share your favorite cafés, try new roasts, and start the day right with great company." },
      { name: "Espresso Yourself", tagline: "Every cup tells a story", description: "A community for coffee lovers who believe a great café is the best place to connect." },
      { name: "Flat White Friends", tagline: "Good coffee, great conversations", description: "Meet new people over expertly crafted coffee at the best spots in your neighborhood." },
      { name: "The Drip", tagline: "Stay warm, stay connected", description: "Weekly coffee meetups and café recommendations for anyone who runs on caffeine and community." },
      { name: "Roast & Toast", tagline: "From bean to bond", description: "Coffee tastings, roastery visits, and morning meetups for the serious and casual coffee fan." },
      { name: "Brew Buddies", tagline: "Your café, your crew", description: "Find your coffee tribe—morning meetups, café discovery, and good vibes over great coffee." },
      { name: "Third Wave Crew", tagline: "Specialty coffee, real connections", description: "Explore specialty cafés, learn about origins and roasting, and meet fellow coffee connoisseurs." },
    ],
  },
  {
    categoryName: "brunch",
    placeholders: [
      { name: "Sunday Brunch Bunch", tagline: "The best meal of the week", description: "Weekend brunch outings to discover the best mimosas, pancakes, and vibes in the area." },
      { name: "Eggs & Ends", tagline: "Start weekends the right way", description: "Brunch crawls, bottomless mimosa hunts, and lazy morning gatherings with great people." },
      { name: "The Brunch Club", tagline: "Always worth waking up for", description: "Weekly brunch outings to discover new spots, share plates, and soak up the weekend." },
      { name: "Mimosa Mob", tagline: "Pour it up, make it count", description: "Bottomless brunches, rooftop morning meetups, and all things weekend indulgence." },
      { name: "Late Rise Crew", tagline: "Sleep in, brunch out", description: "For those who believe brunch is a lifestyle—great food, great drinks, great company." },
      { name: "Stack & Sip", tagline: "Pancakes and possibilities", description: "Fluffy stacks, fresh juice, and friendly faces at the best brunch spots around town." },
      { name: "Brunch & Bunch", tagline: "Who needs breakfast or lunch?", description: "Spend your Saturday mornings exploring new brunch spots with people who love good food." },
      { name: "Golden Hour Eats", tagline: "Morning light, midday vibes", description: "Brunch outings that blend great food with golden-hour ambiance and good conversation." },
      { name: "Egg Hunt Club", tagline: "The perfect brunch is out there", description: "On a mission to find the best eggs benny, avocado toast, and French toast in town." },
      { name: "Weekend Table", tagline: "Your Saturday starts here", description: "Reserved every weekend for good food, slow mornings, and the best brunch company around." },
    ],
  },
  {
    categoryName: "farmers_market",
    placeholders: [
      { name: "Market Wanderers", tagline: "Shop local, eat fresh", description: "Explore local farmers markets together, share finds, and support local growers and artisans." },
      { name: "Fresh Finds Crew", tagline: "From farm to your basket", description: "Weekly market trips, vendor recommendations, and recipes from locally sourced ingredients." },
      { name: "The Market Bag", tagline: "Fill it with something good", description: "Discover seasonal produce, artisan goods, and local makers at markets near you." },
      { name: "Local Harvest Gang", tagline: "Grown close, shared together", description: "A community of market lovers who believe in fresh food and supporting local farmers." },
      { name: "Seasonal Shoppers", tagline: "Every season has something special", description: "Explore what's in season, share recipes, and make market mornings a weekly tradition." },
      { name: "Stall Hoppers", tagline: "Market hopping made better together", description: "Wander the stalls, taste samples, and find your new favorite local vendors with this crew." },
      { name: "Root & Bloom", tagline: "From the ground up", description: "Garden lovers and market enthusiasts unite to support local agriculture and seasonal eating." },
      { name: "Basket Brigade", tagline: "Together we shop better", description: "Organized market trips, group buys, and recipe swaps for the locally-sourced food lover." },
      { name: "The Saturday Market", tagline: "Make it a ritual", description: "Turn your weekend market run into a social outing with fellow fresh-food lovers." },
      { name: "Grow Local Circle", tagline: "Good food starts close to home", description: "A community connecting market-goers, farmers, and foodies who care about where food comes from." },
    ],
  },
  {
    categoryName: "wine_and_spirits",
    placeholders: [
      { name: "Pour & Savor", tagline: "Sip, swirl, and socialize", description: "Wine tastings, brewery tours, and cocktail nights for enthusiasts of fine beverages." },
      { name: "The Tasting Room", tagline: "Every glass tells a story", description: "Curated wine nights, distillery visits, and spirit pairings for the discerning sipper." },
      { name: "Uncorked", tagline: "Open a bottle, open a friendship", description: "Casual wine tastings and guided pairings for beginners and enthusiasts alike." },
      { name: "Spirit Seekers", tagline: "Always chasing the perfect pour", description: "Whiskey flights, craft cocktail nights, and brewery hops for the adventurous palate." },
      { name: "Grape Expectations", tagline: "The next great wine is waiting", description: "Discover new varietals, meet winemakers, and share your tasting notes with fellow enthusiasts." },
      { name: "Swirl & Social", tagline: "Sip more, stress less", description: "A social wine and spirits club that blends education with great conversation and good pours." },
      { name: "The Cork Collective", tagline: "Community aged to perfection", description: "Wine lovers gathering for tastings, cellar tours, and seasonal pairing dinners together." },
      { name: "Liquid Library", tagline: "So many bottles, so little time", description: "Explore the world's finest wines and spirits one tasting at a time with curious company." },
      { name: "Craft & Cask", tagline: "Handcrafted sips, genuine connections", description: "Craft beer, artisan spirits, and small-batch wines — explored together by curious drinkers." },
      { name: "Last Round Crew", tagline: "Make every round count", description: "From happy hour finds to late-night cocktail bars — drinking well and meeting great people." },
    ],
  },

  // ── Active ─────────────────────────────────────────────────────────────────
  {
    categoryName: "fitness_classes",
    placeholders: [
      { name: "FitFam Local", tagline: "Sweat it out together", description: "Join group fitness classes, bootcamps, and workout sessions with neighbors who love staying active." },
      { name: "Class Pass Crew", tagline: "Try everything, commit to nothing", description: "Explore different fitness classes together—HIIT, spin, barre, and beyond." },
      { name: "Sweat Society", tagline: "Better workouts, better people", description: "Find your fitness family for group classes, challenges, and accountability." },
      { name: "Rep Squad", tagline: "Every rep is better with a buddy", description: "A crew for gym-goers and class addicts who love pushing limits with good people." },
      { name: "Studio Hoppers", tagline: "New class every week", description: "Rotate through the best fitness studios in town, try new formats, and stay motivated." },
      { name: "Burn Crew", tagline: "Show up. Work hard. Repeat.", description: "Local fitness enthusiasts sharing class reviews, tips, and sweat sessions together." },
      { name: "The Lift Circle", tagline: "Lift each other up", description: "Strength training, fitness classes, and motivation for anyone ready to level up." },
      { name: "Active Neighbors", tagline: "Fitness close to home", description: "Local group classes, workout partners, and fitness events right in your neighborhood." },
      { name: "No Excuses Club", tagline: "Your accountability partners", description: "Join a crew that shows up even on the hard days — classes, challenges, and community." },
      { name: "First Timers Fitness", tagline: "Every expert was once a beginner", description: "A welcoming space to try group fitness classes with supportive, encouraging people." },
    ],
  },
  {
    categoryName: "pickleball",
    placeholders: [
      { name: "Pickle Posse", tagline: "Dink, drive, and have fun", description: "Casual and competitive pickleball games for players of all levels in your area." },
      { name: "Dink Dynasty", tagline: "Dinking our way to the top", description: "A serious-fun pickleball group for players who love the game and love the crew." },
      { name: "The Kitchen Crew", tagline: "Stay out of the kitchen... or don't", description: "Beginner to advanced pickleball players organizing games, clinics, and tournaments nearby." },
      { name: "Rally Round", tagline: "Every game is a good game", description: "Pickup pickleball games, round-robins, and friendly competition for all skill levels." },
      { name: "Net Gains", tagline: "Win some, learn some", description: "A welcoming pickleball group focused on improvement, fun, and community." },
      { name: "Paddle Up", tagline: "Grab your paddle, let's play", description: "Organized pickleball games and social events for the fastest growing sport around." },
      { name: "Third Shot Club", tagline: "Mastering the drop one game at a time", description: "For pickleball lovers who want to improve their game and enjoy great competition nearby." },
      { name: "The Picklers", tagline: "It's a lifestyle", description: "Weekly games, mixers, and socials for the pickleball-obsessed community near you." },
      { name: "Smash & Dash", tagline: "Fast games, faster friendships", description: "High-energy pickleball sessions, tournaments, and mixers for competitive and casual players." },
      { name: "Cross-Court Crew", tagline: "See you on the other side", description: "Pickleball matchups, round-robins, and post-game hangouts for players who love the sport." },
    ],
  },
  {
    categoryName: "hiking",
    placeholders: [
      { name: "Trail Blazers", tagline: "Explore trails and make friends", description: "Weekend hikes, trail recommendations, and outdoor adventures for nature lovers of every skill level." },
      { name: "Peak Seekers", tagline: "Always chasing the summit", description: "Organized hikes from beginner-friendly walks to challenging peak summits near you." },
      { name: "The Wanderers", tagline: "Follow the trail, find yourself", description: "Group hikes, nature walks, and outdoor explorations for those who love to roam." },
      { name: "Boot Camp Hikers", tagline: "Lace up and hit the trail", description: "Weekly hikes, trail reviews, and outdoor adventures for hikers of all fitness levels." },
      { name: "Elevation Nation", tagline: "Every step higher is worth it", description: "A hiking community that loves views, fresh air, and the people you meet on the trail." },
      { name: "Forest Bathing Crew", tagline: "Nature is the therapy", description: "Slow, mindful hikes and nature walks for people who love the outdoors and good conversation." },
      { name: "Trail Mix", tagline: "Different paths, same passion", description: "A diverse hiking group exploring local trails, national parks, and hidden gems together." },
      { name: "Summit Society", tagline: "We go up", description: "Challenge hikes, peak bagging, and mountain adventures for the ambitious outdoor lover." },
      { name: "Step by Step", tagline: "Every trail starts with one step", description: "A beginner-friendly hiking group making the outdoors accessible and fun for everyone." },
      { name: "The Wild Ones", tagline: "Born to roam", description: "Group hikes, overnight trips, and wilderness exploration for nature-loving adventurers." },
    ],
  },
  {
    categoryName: "running",
    placeholders: [
      { name: "Morning Mile Crew", tagline: "Lace up and hit the road together", description: "A group for runners of all levels who want to train, share routes, and stay motivated together." },
      { name: "Pavement Pounders", tagline: "Miles logged, friends made", description: "Weekly group runs, route planning, and race training for runners in your neighborhood." },
      { name: "The Run Club", tagline: "Every run is better together", description: "Casual and structured running meetups, 5K training, and post-run coffee for all paces." },
      { name: "Stride Squad", tagline: "Keep moving, keep connecting", description: "A supportive running community for beginners to seasoned racers who run better together." },
      { name: "Track Stars", tagline: "Fast or slow, just show up", description: "Group workouts, interval training, and social runs for runners who love the community." },
      { name: "Run the Town", tagline: "Your city is your track", description: "Explore your city's best running routes with fellow runners who know the way." },
      { name: "Miles & Smiles", tagline: "Running makes everything better", description: "A fun, welcoming running group for those who believe the post-run feeling is always worth it." },
      { name: "Pace Setters", tagline: "Set your pace, find your people", description: "Running groups organized by pace so everyone runs at a comfortable and motivating speed." },
      { name: "The Long Run Crew", tagline: "Distance runners unite", description: "Weekend long runs, marathon training, and endurance building for the dedicated runner." },
      { name: "5K to Finish", tagline: "Start somewhere, go anywhere", description: "Beginner to advanced runners building mileage, sharing tips, and crossing finish lines together." },
    ],
  },
  {
    categoryName: "team_sports",
    placeholders: [
      { name: "Weekend Warriors", tagline: "Play together, win together", description: "Pickup games, leagues, and scrimmages for basketball, soccer, volleyball and more." },
      { name: "The Pickup", tagline: "Always room for one more", description: "Casual pickup games across sports — no experience required, just show up and play." },
      { name: "Rec League Legends", tagline: "We take the fun seriously", description: "Recreational leagues and pickup games for adults who love to compete and connect." },
      { name: "All In Athletic", tagline: "Every sport, every level", description: "A multi-sport group running pickup games and leagues for basketball, soccer, flag football, and more." },
      { name: "Squad Goals", tagline: "Better teams make better games", description: "Find teammates, form squads, and compete in organized sports leagues in your area." },
      { name: "Ball Is Life", tagline: "Sport is our love language", description: "From hoops to soccer to volleyball — a community for sports lovers who want to play more." },
      { name: "The Scrimmage", tagline: "Friendly competition, real fun", description: "Organized scrimmages, pickup games, and social sports events for all levels of athlete." },
      { name: "Play Ball Crew", tagline: "Just here to have a good time", description: "Low-pressure, high-fun team sports for adults who want to stay active and make friends." },
      { name: "Court & Field", tagline: "Every sport needs great teammates", description: "Connect with players, form teams, and compete in the sports you love near you." },
      { name: "MVP Club", tagline: "Most Valuable Players, most fun people", description: "A sports community where competition meets camaraderie — join a team and find your people." },
    ],
  },
  {
    categoryName: "cycling",
    placeholders: [
      { name: "Pedal Pals", tagline: "Ride together, go further", description: "Group rides, route sharing, and bike maintenance tips for cyclists in the neighborhood." },
      { name: "Chain Gang", tagline: "Stronger together on two wheels", description: "Weekly group rides, cycling challenges, and community for road, gravel, and mountain bikers." },
      { name: "The Peloton", tagline: "Draft off each other's energy", description: "Organized group rides for road cyclists who love pushing each other and the pace." },
      { name: "Spoke & Spoke", tagline: "Two wheels, endless roads", description: "Social cycling for casual riders and weekend warriors who love exploring by bike." },
      { name: "Handlebar Heroes", tagline: "No hill too steep with good company", description: "A cycling group that conquers local climbs, epic routes, and post-ride coffee together." },
      { name: "Urban Cyclists", tagline: "The city is our velodrome", description: "Commuters, leisure riders, and urban cyclists sharing routes, tips, and group rides in the city." },
      { name: "Gravel Grinders", tagline: "Off the beaten path is on the route", description: "Adventure cyclists exploring gravel roads, bike-packing routes, and mixed-terrain rides." },
      { name: "Two Wheel Tribe", tagline: "Life is better on a bike", description: "A welcoming cycling community for all types of riders — road, MTB, e-bike, or cruiser." },
      { name: "Crank Crew", tagline: "Put in the miles together", description: "Training rides, charity events, and social cycling for people who love life on two wheels." },
      { name: "Bike & Beyond", tagline: "Ride more, worry less", description: "Group cycling adventures, bikepacking trips, and rides for those who see the bike as freedom." },
    ],
  },
  {
    categoryName: "yoga",
    placeholders: [
      { name: "Flow Together", tagline: "Stretch, breathe, and find your balance", description: "Group yoga sessions, pose tutorials, and mindfulness practices for yogis of all levels." },
      { name: "The Mat Collective", tagline: "Your practice, your people", description: "A yoga community gathering for group classes, outdoor sessions, and wellness events nearby." },
      { name: "Root & Rise", tagline: "Ground yourself, lift each other", description: "From gentle stretching to power flow — yoga sessions for all styles and experience levels." },
      { name: "Breathe & Bend", tagline: "Inhale peace, exhale stress", description: "Community yoga classes, breathing workshops, and mindful movement for busy people." },
      { name: "Vinyasa Vibes", tagline: "Flow your way to wellness", description: "Dynamic yoga flows, creative sequencing, and a supportive community for movers and shakers." },
      { name: "Asana Assembly", tagline: "Show up on the mat, leave transformed", description: "Group yoga meetups across styles — hatha, yin, restorative, and everything in between." },
      { name: "Namaste Neighbors", tagline: "Peace starts in the community", description: "Outdoor yoga sessions, community classes, and mindfulness events for local wellness lovers." },
      { name: "The Gentle Stretch", tagline: "Wellness at your own pace", description: "A welcoming yoga community for beginners and those who prefer slow, intentional movement." },
      { name: "Sunrise Yoga Crew", tagline: "Start every morning with intention", description: "Early morning yoga meetups to center your mind and body before the day begins." },
      { name: "Flex & Flow", tagline: "Move freely, live well", description: "A flexible yoga community exploring different styles, teachers, and locations together." },
    ],
  },
  {
    categoryName: "dance",
    placeholders: [
      { name: "Rhythm & Moves", tagline: "Dance like nobody's watching", description: "Salsa, hip-hop, ballroom or freestyle — find your groove with fellow dance lovers nearby." },
      { name: "The Dance Floor", tagline: "Your stage, your crew", description: "Social dance events, freestyle nights, and lessons for dancers of all styles and levels." },
      { name: "Move It Crew", tagline: "When in doubt, dance it out", description: "Weekly dance sessions, social dances, and choreography workshops in your neighborhood." },
      { name: "Step & Sway", tagline: "Every beat is an invitation", description: "Salsa nights, swing classes, and ecstatic dance for anyone who loves moving to music." },
      { name: "Groove Society", tagline: "Life is better when you're dancing", description: "A vibrant community hosting dance classes, open floors, and social events for all dance styles." },
      { name: "Latin Nights Crew", tagline: "Feel the rhythm, move your feet", description: "Salsa, bachata, and cumbia lovers gathering for classes, socials, and Latin dance nights." },
      { name: "Street Dance Collective", tagline: "Dance where you are", description: "Hip-hop, breakdancing, and urban movement workshops and freestyle sessions nearby." },
      { name: "Ballroom Bound", tagline: "Elegance in every step", description: "Learn ballroom, waltz, tango, and foxtrot with partners and instructors in your area." },
      { name: "Free Spirit Dance", tagline: "No rules, just movement", description: "Ecstatic dance, freestyle, and embodied movement gatherings for the free-spirited mover." },
      { name: "Dance Anywhere", tagline: "The whole world is your dance floor", description: "Pop-up dance sessions, flash mob planning, and impromptu dance meetups near you." },
    ],
  },
  {
    categoryName: "tennis",
    placeholders: [
      { name: "Local Racket Club", tagline: "Find your doubles partner", description: "Casual rallies, friendly matches, and skill-building sessions for tennis enthusiasts nearby." },
      { name: "Ace Collective", tagline: "Serve, rally, connect", description: "Weekly tennis games, ladder tournaments, and social events for players of all skill levels." },
      { name: "Net Set Match", tagline: "Love the game, love the people", description: "Tennis matchups, lessons, and social events for recreational players and serious competitors." },
      { name: "Baseline Crew", tagline: "Every point tells a story", description: "Consistent group play, drills, and friendly competition for tennis players near you." },
      { name: "Deuce & Done", tagline: "Two sets, one community", description: "Social tennis with an emphasis on fun, improvement, and post-match hangouts." },
      { name: "Topspin Tribe", tagline: "Spin it, win it, share it", description: "A tennis community for players who love improving their game with great hitting partners." },
      { name: "Open Court", tagline: "Anyone can play", description: "A welcoming tennis group for beginners and casual players who just love the game." },
      { name: "Rally Mates", tagline: "Better together at the baseline", description: "Find your regular hitting partners, join doubles leagues, and improve through consistent play." },
      { name: "Match Point Club", tagline: "Every match is a new memory", description: "Organized match play, round-robins, and league tennis for competitors who love the sport." },
      { name: "Swing & Social", tagline: "Tennis by day, social by nature", description: "Tennis mornings followed by social time — for players who love the court and the company." },
    ],
  },

  // ── Creative ───────────────────────────────────────────────────────────────
  {
    categoryName: "cooking",
    placeholders: [
      { name: "Home Chef Collective", tagline: "Cook, share, and savor together", description: "Swap recipes, host cook-alongs, and explore cuisines from around the world with fellow foodies." },
      { name: "Mise en Place", tagline: "Prep, cook, and connect", description: "A culinary community for home cooks who love learning techniques, sharing recipes, and eating well." },
      { name: "Whisk & Wonder", tagline: "Every recipe is an adventure", description: "Cook-along sessions, ingredient deep-dives, and potluck dinners for passionate home cooks." },
      { name: "The Kitchen Table", tagline: "Where good food brings people together", description: "A gathering place for home cooks to share recipes, skills, and memorable meals together." },
      { name: "Flavor Lab", tagline: "Experiment. Taste. Repeat.", description: "Creative cooking sessions, technique workshops, and recipe challenges for curious home chefs." },
      { name: "Supper Club", tagline: "Cook together, eat together", description: "An intimate dinner-club experience bringing neighbors together through food and shared tables." },
      { name: "Noodle & Knife", tagline: "Mastering the basics and beyond", description: "Cooking workshops, technique tutorials, and potlucks for aspiring home chefs of all levels." },
      { name: "Global Kitchen", tagline: "Travel the world one dish at a time", description: "Cook cuisines from around the world with fellow food adventurers in your neighborhood." },
      { name: "Pantry Pals", tagline: "What's in your fridge?", description: "A creative cooking community turning everyday ingredients into extraordinary meals together." },
      { name: "The Recipe Exchange", tagline: "Your best dish, my best dish", description: "Share family recipes, discover new favorites, and gather around the table with neighbors." },
    ],
  },
  {
    categoryName: "board_games",
    placeholders: [
      { name: "Game Night Gang", tagline: "Roll the dice and have fun", description: "Regular game nights with board games, card games, and tabletop RPGs for all experience levels." },
      { name: "The Board Room", tagline: "Strategy, luck, and good company", description: "Weekly board game nights featuring modern favorites, classics, and everything in between." },
      { name: "Table Top Tribe", tagline: "Life is a game worth playing", description: "A tabletop gaming community hosting game nights, tournaments, and new game discovery events." },
      { name: "Dice & Drinks", tagline: "Roll the dice, pour the fun", description: "Casual board game nights at local spots for gamers who love social play and good drinks." },
      { name: "Strategy Circle", tagline: "Outplay, outlast, out-fun", description: "Serious board game enthusiasts meeting for strategic games, campaign plays, and tournaments." },
      { name: "Card Sharks", tagline: "Every hand is a new story", description: "Card game enthusiasts gathering for poker, bridge, and modern card games near you." },
      { name: "Quest Crew", tagline: "On a quest for the best game", description: "Tabletop RPG adventures, dungeon crawls, and fantasy board game sessions near you." },
      { name: "Game Changers", tagline: "Change your evenings for the better", description: "A welcoming board game group introducing new games and players to the hobby every week." },
      { name: "Meeple Meetup", tagline: "Find your fellow meeples", description: "Euro game lovers, worker placement fans, and co-op game enthusiasts unite here." },
      { name: "Rules & Rolls", tagline: "Master the game, master the fun", description: "Board game learning sessions, rules explanations, and play-through events for curious gamers." },
    ],
  },
  {
    categoryName: "arts_and_crafts",
    placeholders: [
      { name: "Creative Corner", tagline: "Make something beautiful together", description: "Share your creations, join craft nights, and learn new techniques with fellow artists and makers." },
      { name: "The Maker Space", tagline: "Create. Build. Connect.", description: "A community of makers and crafters sharing projects, skills, and creative inspiration." },
      { name: "Crafty Neighbors", tagline: "Crafts are better with company", description: "Craft nights, DIY workshops, and creative projects for makers of all skill levels nearby." },
      { name: "Stitch & Sip", tagline: "Craft a little, sip a little", description: "Knitting, crocheting, embroidery, and handcraft sessions with good drinks and good company." },
      { name: "The Studio Circle", tagline: "Where creativity comes to life", description: "Painting, drawing, ceramics, and mixed media — a creative community for visual art lovers." },
      { name: "Handmade Hub", tagline: "Made by hand, made with heart", description: "Connect with local crafters, share handmade projects, and learn new arts and crafts techniques." },
      { name: "Glue Gun Gang", tagline: "Crafting chaos with purpose", description: "DIY enthusiasts sharing project ideas, craft hacks, and messy creative fun together." },
      { name: "Art After Hours", tagline: "Get creative after the workday", description: "Evening art workshops and craft sessions for those who want to unwind and make something." },
      { name: "The Craft Collective", tagline: "One community, many crafts", description: "From papercraft to pottery — a diverse crafting community welcoming all creative mediums." },
      { name: "Makers & Muses", tagline: "Inspire and be inspired", description: "Artists and crafters gathering to share work, spark ideas, and fuel each other's creativity." },
    ],
  },
  {
    categoryName: "book_clubs",
    placeholders: [
      { name: "Page Turners", tagline: "Read, discuss, repeat", description: "Monthly book picks, lively discussions, and literary adventures with fellow readers nearby." },
      { name: "The Reading Room", tagline: "Where stories come alive", description: "A book club gathering monthly to explore fiction, non-fiction, and everything in between." },
      { name: "Chapter & Verse", tagline: "One book at a time, one friend at a time", description: "Thoughtful book discussions, reading challenges, and literary events for passionate readers." },
      { name: "Shelf Life", tagline: "Your next read is waiting", description: "Curated reading lists, lively debates, and genre-spanning book clubs for avid readers." },
      { name: "The Lit Circle", tagline: "Great books, greater conversations", description: "In-depth literary discussion groups for readers who love to dig into what a story really means." },
      { name: "Between the Lines", tagline: "Read more, discover more", description: "A diverse book club exploring varied genres, authors, and perspectives through great literature." },
      { name: "Novel Neighbors", tagline: "Books bring us closer together", description: "A neighborhood book club turning strangers into friends one story at a time." },
      { name: "Book & Brew", tagline: "Read well, drink better", description: "Monthly book club meetings paired with wine, coffee, and great literary conversation." },
      { name: "Late Night Readers", tagline: "One more chapter... always", description: "A book club for night owls and avid readers who love losing track of time in a good book." },
      { name: "The Open Book", tagline: "No judgment, just reading", description: "An inclusive and relaxed book club welcoming all reading levels, genres, and tastes." },
    ],
  },
  {
    categoryName: "photography",
    placeholders: [
      { name: "Shutter Squad", tagline: "Capture the moment together", description: "Photo walks, editing tips, and portfolio sharing for photographers at every level." },
      { name: "Frame & Focus", tagline: "Every shot tells a story", description: "A photography community for hobbyists and enthusiasts exploring composition, light, and creativity." },
      { name: "Lens & Light", tagline: "Find the beauty in everything", description: "Photo walks, golden-hour shoots, and editing workshops for photography lovers of all skill levels." },
      { name: "The Exposure", tagline: "Develop your eye, develop your craft", description: "Portfolio critiques, shooting challenges, and photo meetups for passionate photographers nearby." },
      { name: "Golden Hour Club", tagline: "Chase the light together", description: "Sunrise and sunset photography outings, location scouting, and light-chasing adventures." },
      { name: "Raw & Unfiltered", tagline: "Authentic photography, real connections", description: "A photography group celebrating unedited, candid, and storytelling photography together." },
      { name: "Click Collective", tagline: "A community as sharp as your focus", description: "Photo challenges, gear discussions, and group shoots for photographers of every style." },
      { name: "Urban Lens", tagline: "Find the extraordinary in the everyday", description: "Street photography, urban exploration, and documentary photography in your own backyard." },
      { name: "Aperture Assembly", tagline: "Open your lens, open your world", description: "Technical workshops, location guides, and creative shoots for photographers who want to grow." },
      { name: "Snapshot Society", tagline: "Every moment is worth capturing", description: "A casual photography community for those who love capturing life with any camera they have." },
    ],
  },
  {
    categoryName: "music",
    placeholders: [
      { name: "Jam Session Crew", tagline: "Make music, make friends", description: "Jam sessions, open mics, and music appreciation meetups for musicians and music lovers." },
      { name: "The Sound Collective", tagline: "Play together, sound better", description: "Musicians at all levels gathering to jam, collaborate, and share the joy of making music." },
      { name: "Open Chord", tagline: "Everyone has a song in them", description: "Open jam nights, music sharing, and beginner-friendly sessions for aspiring musicians nearby." },
      { name: "Local Harmony", tagline: "Music is better shared", description: "A music community bringing together players of all instruments for jams and live sessions." },
      { name: "The Session", tagline: "Plug in, turn up, connect", description: "Weekly jam sessions, improvisational music nights, and open mics for local musicians." },
      { name: "Riff Collective", tagline: "Every riff starts a conversation", description: "Guitar, bass, drums and beyond — a community for musicians who love playing together." },
      { name: "Backline Brigade", tagline: "Gear, songs, and great vibes", description: "Musicians and music lovers sharing gear tips, setlists, and performance opportunities nearby." },
      { name: "Melody Makers", tagline: "Find your musical family", description: "Collaborative music sessions, songwriting circles, and performance events for local musicians." },
      { name: "Stage Fright Club", tagline: "Conquer the mic, together", description: "A supportive community for performers working on stage presence, originals, and live performance." },
      { name: "The Sound Check", tagline: "Always tuned in", description: "Music enthusiasts and players connecting over live sessions, concert outings, and sonic adventures." },
    ],
  },

  // ── Lifestyle ──────────────────────────────────────────────────────────────
  {
    categoryName: "gardening",
    placeholders: [
      { name: "Green Thumb Gang", tagline: "Grow together, bloom together", description: "Tips, plant swaps, and garden tours for anyone who loves getting their hands in the dirt." },
      { name: "The Garden Collective", tagline: "Tend the earth, tend the community", description: "A gardening community sharing seeds, cuttings, techniques, and love for all things green." },
      { name: "Bloom & Grow", tagline: "Plant seeds, grow friendships", description: "Gardening workshops, plant swaps, and seasonal growing guides for backyard and balcony gardeners." },
      { name: "Dirt & Delight", tagline: "Happy plants, happier people", description: "Connect with fellow gardeners to share tools, tips, and the joy of watching things grow." },
      { name: "The Plot Thickens", tagline: "Every garden has a story", description: "Community gardening, plot sharing, and growing guides for urban and suburban gardeners alike." },
      { name: "Leaf & Lore", tagline: "Ancient wisdom, modern gardens", description: "Permaculture, native planting, and sustainable gardening for those who grow with intention." },
      { name: "Seedling Society", tagline: "Every big garden starts with a seed", description: "A beginner-friendly gardening group helping new growers get started and flourish." },
      { name: "Backyard Botanists", tagline: "Science, soil, and fresh air", description: "Plant nerds sharing propagation tips, growing experiments, and botanical discoveries." },
      { name: "The Harvest Circle", tagline: "Plant it forward", description: "Community vegetable gardens, harvest sharing, and growing-to-eat guides for local gardeners." },
      { name: "Pots & Plots", tagline: "No garden too small", description: "A community for container gardeners, balcony growers, and small-space horticulture lovers." },
    ],
  },
  {
    categoryName: "dog_pet_groups",
    placeholders: [
      { name: "Paws & Friends", tagline: "Playdates for pets and their humans", description: "Connect with local pet owners for walks, playdates, pet-sitting swaps, and adorable photo shares." },
      { name: "Dog Days", tagline: "Every day is a good day with a dog", description: "Dog walks, off-leash meetups, and neighborhood pet resources for dog owners in your area." },
      { name: "The Pack", tagline: "Your dog's crew and yours too", description: "Organized dog park meetups, group walks, and pet-owner socials for the dog-obsessed community." },
      { name: "Furever Friends", tagline: "Pets bring people together", description: "A community for pet owners of all kinds — sharing tips, meetups, and pet-care resources." },
      { name: "Leash & Lead", tagline: "Walk more, connect more", description: "Neighborhood dog-walking groups, trail meetups, and canine community events near you." },
      { name: "Wag Club", tagline: "Tails wagging, people smiling", description: "Dog playdates, dog-friendly event discovery, and a community that puts pups first." },
      { name: "Cat People", tagline: "Proudly obsessed with cats", description: "A community for cat owners sharing tips, photos, vet recommendations, and cat-sitting swaps." },
      { name: "Critter Crew", tagline: "All pets welcome here", description: "An inclusive pet community for dog, cat, bird, rabbit, and all-animal owners to connect." },
      { name: "Bark & Bond", tagline: "Two dogs, one friendship", description: "Regular dog meetups, pet-friendly event planning, and a social network for local dog owners." },
      { name: "The Animal Lovers", tagline: "Life's better with animals", description: "Pet wellness, adoption advocacy, and community for anyone who believes animals make life richer." },
    ],
  },
  {
    categoryName: "family_circles",
    placeholders: [
      { name: "Parent Connect", tagline: "Raising kids together", description: "A supportive space for parents and caregivers to share tips, arrange playdates, and build community." },
      { name: "Little Feet Big Village", tagline: "It takes a village", description: "Parents connecting over playdates, parenting tips, and local family-friendly events nearby." },
      { name: "Raising Them Together", tagline: "Parenthood is better shared", description: "A community of parents sharing the highs and lows of raising kids in your neighborhood." },
      { name: "The Family Hub", tagline: "Everything families need in one place", description: "Local family events, kid-friendly recommendations, and a network of supportive parents nearby." },
      { name: "Playdate Partners", tagline: "Because kids need friends too", description: "Organize playdates, share activity ideas, and find families with kids the same age nearby." },
      { name: "Moms & Munchkins", tagline: "Keeping mamas sane, kids happy", description: "A community of mothers sharing resources, organizing meetups, and supporting each other." },
      { name: "Dads on Duty", tagline: "Fatherhood, better together", description: "A space for dads to share parenting wins, organize kid activities, and connect with other fathers." },
      { name: "The Tot Spot", tagline: "Little kids, big community", description: "Baby and toddler playdates, parenting support, and family-friendly event planning near you." },
      { name: "Growing Together", tagline: "Every stage is better as a community", description: "A multigenerational family community supporting parents from newborns to teenagers." },
      { name: "Family Roots", tagline: "Strong families build strong communities", description: "A neighborhood family circle sharing values, activities, traditions, and support year-round." },
    ],
  },
  {
    categoryName: "wellness",
    placeholders: [
      { name: "Mindful Living Circle", tagline: "Nurture your mind, body, and soul", description: "Meditation sessions, wellness challenges, and self-care tips to help you feel your best." },
      { name: "The Wellness Collective", tagline: "Healthy habits, happy lives", description: "A holistic wellness community sharing mental health resources, movement practices, and self-care rituals." },
      { name: "Balance & Bloom", tagline: "Find your center, then share it", description: "Meditation, breathwork, journaling, and wellness events for those seeking more balance." },
      { name: "Restore & Renew", tagline: "Rest is part of the journey", description: "A community focused on recovery, sleep, stress relief, and sustainable health practices." },
      { name: "Inner Circle Wellness", tagline: "Well-being from the inside out", description: "Mental health meetups, mindfulness sessions, and wellness workshops in a safe, supportive space." },
      { name: "Nourish Network", tagline: "Feed your body, feed your soul", description: "Nutrition tips, mindful eating, and holistic health practices for whole-body wellness." },
      { name: "The Reset", tagline: "Reclaim your energy", description: "Wellness challenges, detox programs, and community accountability for your health goals." },
      { name: "Still & Strong", tagline: "Quiet strength, lasting wellness", description: "A community blending stillness practices (meditation, yoga) with physical resilience and health." },
      { name: "Whole Self", tagline: "You are more than your to-do list", description: "Holistic wellness for mind, body, and spirit — community events, workshops, and everyday habits." },
      { name: "Thrive Together", tagline: "Wellness is a team sport", description: "Accountability partners, wellness goals, and community support to help everyone thrive." },
    ],
  },

  // ── Adventure & Outdoors ───────────────────────────────────────────────────
  {
    categoryName: "travel_and_exploration",
    placeholders: [
      { name: "Wanderlust Club", tagline: "Explore new places together", description: "Group trips, travel tips, and exploration meetups for adventurers who love discovering new destinations." },
      { name: "The Expedition", tagline: "Adventure awaits around every corner", description: "Plan group travel, share destination guides, and find travel companions for your next big trip." },
      { name: "Passport Pals", tagline: "More fun with a travel buddy", description: "Connect with fellow travelers planning trips, seeking recommendations, and sharing travel stories." },
      { name: "Beyond Borders", tagline: "The world is bigger together", description: "International travel groups, cultural exchange, and global adventure planning with local explorers." },
      { name: "Day Tripper Crew", tagline: "Adventure doesn't need a plane", description: "Day trips, weekend getaways, and local exploration for those who love to discover nearby." },
      { name: "The Travel Circle", tagline: "Every destination is a new story", description: "Travel planning, destination sharing, and group trips for curious explorers of all kinds." },
      { name: "Nomad Network", tagline: "Roots optional, adventure required", description: "Digital nomads, frequent travelers, and adventure seekers connecting, planning, and exploring." },
      { name: "Local Explorers", tagline: "Extraordinary is right around the corner", description: "Discover underrated destinations, hidden spots, and weekend adventures in your own region." },
      { name: "Journey Together", tagline: "The journey matters as much as the destination", description: "Group travel adventures balancing culture, nature, and the joy of exploring with great people." },
      { name: "Off the Beaten Track", tagline: "Find what maps don't show", description: "Offbeat travel, alternative destinations, and adventurous itineraries for the curious traveler." },
    ],
  },
  {
    categoryName: "beach_and_water",
    placeholders: [
      { name: "Shore Squad", tagline: "Life's better by the water", description: "Beach days, surfing, kayaking, and water activities with fellow ocean and lake lovers." },
      { name: "Salt & Sun", tagline: "Sun-soaked memories, sea-breeze friendships", description: "Beach meetups, ocean sports, and waterfront social events for water lovers near you." },
      { name: "The Wave Riders", tagline: "Ride it, love it, repeat", description: "Surfing, bodyboarding, and ocean adventure for those who hear the call of the waves." },
      { name: "Tides & Tribes", tagline: "Where the sea brings people together", description: "Beach volleyball, paddleboarding, snorkeling, and ocean life for the water-obsessed community." },
      { name: "Blue Water Crew", tagline: "Every body of water is an adventure", description: "Lake days, river floats, ocean swims, and water sports for those who live for blue water." },
      { name: "Dock & Drift", tagline: "Anchor down, let the good times float", description: "Boating, kayaking, paddleboarding, and waterfront hangouts for lake and ocean enthusiasts." },
      { name: "The Swim Club", tagline: "Just keep swimming, together", description: "Open water swimming, lake laps, and ocean dips for swimmers who prefer natural water." },
      { name: "Sandy Collective", tagline: "Life is a beach — make it social", description: "Beach cleanups, volleyball games, bonfires, and coastal adventures for the beach-loving community." },
      { name: "Coastal Crew", tagline: "Where sand meets community", description: "Seaside meetups, surf lessons, and ocean exploration for those who call the coast home." },
      { name: "Water Wanderers", tagline: "From the river to the sea", description: "Kayaking, rafting, paddleboarding, and all water adventures for the aquatic explorer in you." },
    ],
  },
  {
    categoryName: "camping_and_backpacking",
    placeholders: [
      { name: "Basecamp Crew", tagline: "Sleep under the stars", description: "Plan camping trips, share gear recommendations, and explore the great outdoors together." },
      { name: "Into the Wild", tagline: "Leave the city, find yourself", description: "Backcountry camping, thru-hikes, and wilderness adventures for the serious outdoor explorer." },
      { name: "The Campfire Circle", tagline: "Where stories are shared and stars are counted", description: "Group camping trips, fire-side evenings, and tent-side memories for outdoor lovers near you." },
      { name: "Pack & Go", tagline: "Everything fits in a pack", description: "Ultralight backpacking, gear reviews, and multi-day trail adventures for serious backcountry goers." },
      { name: "Tent Tales", tagline: "Every campsite has a story", description: "Weekend camping trips, site recommendations, and outdoor community for campers of all experience levels." },
      { name: "Wild Nights", tagline: "Rough it, love it", description: "Car camping to backcountry — a community for those who believe the outdoors is the best home." },
      { name: "Leave No Trace Crew", tagline: "Tread lightly, experience deeply", description: "Environmentally conscious campers and hikers committed to protecting wild spaces while exploring them." },
      { name: "The Bivouac", tagline: "Shelter up and explore", description: "Minimalist camping, wild camping, and survival skill workshops for the self-sufficient outdoorsperson." },
      { name: "Summit & Sleep", tagline: "Earn your campsite", description: "Combination hike-camp adventures where the views from the tent make every step worth it." },
      { name: "Trailhead to Tentside", tagline: "Start at the trailhead, end under stars", description: "Guided group camping and backpacking adventures from easy overnighters to multi-day treks." },
    ],
  },

  // ── Community ──────────────────────────────────────────────────────────────
  {
    categoryName: "volunteering_and_nonprofit",
    placeholders: [
      { name: "Give Back Group", tagline: "Make a difference together", description: "Organize volunteer events, support local causes, and connect with others who want to give back." },
      { name: "Hands On", tagline: "Show up. Do good.", description: "A community of volunteers coordinating local service projects, food drives, and community support." },
      { name: "The Good Crew", tagline: "Good people doing good things", description: "Connect with local do-gooders for volunteering, fundraising, and community service events." },
      { name: "Service Squad", tagline: "Your time creates real change", description: "Organized volunteer opportunities at shelters, parks, food banks, and local organizations nearby." },
      { name: "Community Builders", tagline: "Build the neighborhood you want to live in", description: "Volunteer-driven initiatives improving local parks, schools, and community spaces together." },
      { name: "The Impact Network", tagline: "Small actions, big impact", description: "Linking volunteers with meaningful local causes and non-profits making a difference near you." },
      { name: "Forward Together", tagline: "Progress through community", description: "A civic-minded volunteer group tackling local issues, advocating for change, and serving others." },
      { name: "Cause & Effect", tagline: "Your contribution matters", description: "A volunteer community where collective effort creates measurable impact in the local community." },
      { name: "The Helpers", tagline: "Because showing up is everything", description: "Spontaneous and organized volunteer opportunities for people who want to help when it counts." },
      { name: "Pay It Forward Crew", tagline: "What goes around, comes around", description: "A community dedicated to service, kindness, and making the neighborhood a better place for all." },
    ],
  },
  {
    categoryName: "neighborhood_groups",
    placeholders: [
      { name: "Neighborhood Circle", tagline: "Bringing neighbors closer together", description: "A hub for local events, safety updates, recommendations, and getting to know the people around you." },
      { name: "Block Party Crew", tagline: "Your street, your community", description: "Organize block parties, neighborhood cleanups, and local events with the people who live near you." },
      { name: "Know Your Neighbor", tagline: "Community starts at your front door", description: "Introductions, local news, safety tips, and recommendations from and for neighbors nearby." },
      { name: "The Local", tagline: "Hyper-local, hyperconnected", description: "Your neighborhood's digital hub for events, recommendations, lost pets, and real community." },
      { name: "Porch Light", tagline: "A beacon for your community", description: "A warm, welcoming neighborhood group keeping everyone informed, connected, and supported." },
      { name: "Good Neighbors", tagline: "Kindness lives next door", description: "Neighbor-to-neighbor support, skill sharing, and community-building for a stronger neighborhood." },
      { name: "The Commons", tagline: "Shared spaces, shared lives", description: "A neighborhood community managing shared resources, public spaces, and community initiatives." },
      { name: "Street Smart", tagline: "Know your street better", description: "Neighborhood watch, local insights, business recommendations, and community alerts near you." },
      { name: "Together Here", tagline: "Home is better together", description: "Connecting residents through events, shared resources, and the simple act of knowing your neighbors." },
      { name: "The Neighborhood", tagline: "Because community matters", description: "Local events, trusted recommendations, and a connected network of people who share your zip code." },
    ],
  },

  // ── Tech & Professional ────────────────────────────────────────────────────
  {
    categoryName: "professional_networking",
    placeholders: [
      { name: "Career Connect Hub", tagline: "Grow your network, grow your career", description: "A space for professionals to share advice, find mentors, and explore new opportunities together." },
      { name: "The Network", tagline: "Real connections, real opportunities", description: "Professional meetups, industry events, and mentorship for career-driven people near you." },
      { name: "Rise Together", tagline: "Lift as you climb", description: "A professional community for ambitious people committed to growing their careers and helping others." },
      { name: "Industry Insiders", tagline: "Know the people who know the industry", description: "Sector-specific networking events, panels, and professional connections for career growth." },
      { name: "The Referral Network", tagline: "Your next opportunity is one introduction away", description: "Connect with professionals in your field, exchange referrals, and build meaningful career relationships." },
      { name: "Power Lunch Club", tagline: "Networking without the awkwardness", description: "Regular professional lunches, casual meetups, and real conversations for career-minded individuals." },
      { name: "Executive Circle", tagline: "Leadership conversations, leadership connections", description: "Senior professionals sharing insights, experiences, and opportunities at the intersection of leadership." },
      { name: "Young Professionals Hub", tagline: "Building careers and community together", description: "A networking group for emerging professionals in the early stages of their career journeys." },
      { name: "Mentor Match", tagline: "Find the guidance you need", description: "A mentorship-focused professional network connecting experienced leaders with ambitious learners." },
      { name: "Career Catalyst", tagline: "Accelerate your professional growth", description: "Events, workshops, and peer support for professionals actively building, switching, or advancing careers." },
    ],
  },
  {
    categoryName: "coworking_and_work_buddies",
    placeholders: [
      { name: "Work Together Crew", tagline: "Productive company nearby", description: "Find coworking partners, share workspace recommendations, and stay motivated working alongside others." },
      { name: "The Cowork Collective", tagline: "Same goals, shared spaces", description: "Remote workers and freelancers coworking at local cafés, libraries, and shared offices together." },
      { name: "Focus Friends", tagline: "Better work happens in good company", description: "Organized coworking sessions, accountability pairings, and productive meetups for remote workers." },
      { name: "Desk Neighbors", tagline: "Your home office needs company", description: "Find your regular coworking companion and transform solitary remote work into social productivity." },
      { name: "The Remote Squad", tagline: "Work from anywhere, never work alone", description: "A community of remote workers sharing spaces, routines, and the occasional coffee break together." },
      { name: "Deep Work Crew", tagline: "Distraction-free, community-full", description: "Structured coworking sessions for focused, high-output work time alongside motivated people." },
      { name: "Laptop Life", tagline: "Freedom to work, community to grow", description: "Freelancers and remote workers sharing the best spots to work and the best people to work near." },
      { name: "The Productivity Pod", tagline: "Work hard, recharge together", description: "Coworking meetups with Pomodoro sessions, lunch breaks, and post-work socials for remote workers." },
      { name: "Location Independent", tagline: "No office, no problem", description: "Digital nomads, freelancers, and remote workers building community while working anywhere." },
      { name: "Work Local", tagline: "Remote work, local roots", description: "Find your local coworking community, share hot desks, and bring energy back to remote work." },
    ],
  },
  {
    categoryName: "tech_meetups",
    placeholders: [
      { name: "Local Dev Collective", tagline: "Code, learn, and connect", description: "Tech talks, hackathons, and coding sessions for developers and tech enthusiasts in the area." },
      { name: "Build & Ship", tagline: "Build things that matter", description: "A developer community sharing projects, giving feedback, and hosting hackathons near you." },
      { name: "The Stack", tagline: "Every layer of the tech community", description: "Full-stack developers, designers, and product thinkers gathering to share, learn, and build together." },
      { name: "Hacker House", tagline: "Hack first, ask questions later", description: "A scrappy tech meetup for builders who love shipping products, exploring ideas, and collaborating." },
      { name: "Code & Connect", tagline: "Technology is better with community", description: "Tech talks, workshops, and networking events for developers, engineers, and tech enthusiasts." },
      { name: "The Debug Room", tagline: "Where bugs come to die", description: "Collaborative debugging sessions, pair programming, and technical problem-solving meetups near you." },
      { name: "Open Source Circle", tagline: "Build in public, grow together", description: "Open source contributors and enthusiasts collaborating on projects and sharing contributions." },
      { name: "AI Builders Group", tagline: "Building with intelligence", description: "AI, ML, and LLM enthusiasts exploring the frontier of technology through projects and discussions." },
      { name: "Deploy Day", tagline: "Shipping is a team sport", description: "A tech community celebrating launches, sharing post-mortems, and supporting builders at every stage." },
      { name: "The Sprint", tagline: "Move fast, build smart", description: "Rapid-build sessions, weekend hackathons, and product workshops for developers who love momentum." },
    ],
  },
  {
    categoryName: "startup_and_founders",
    placeholders: [
      { name: "Founders Circle", tagline: "Build something great together", description: "Connect with fellow founders, share startup journeys, and find co-founders and collaborators." },
      { name: "Zero to One", tagline: "From idea to reality", description: "Early-stage founder community sharing the raw, real experience of building from scratch." },
      { name: "Startup Garage", tagline: "Where companies are built", description: "Founders, co-founders, and first employees sharing resources, learnings, and startup energy." },
      { name: "The Pitch Room", tagline: "Practice your pitch, refine your vision", description: "Founder meetups, pitch feedback sessions, and investor introductions for early-stage startups." },
      { name: "Build in Public", tagline: "Show your work, grow your business", description: "A community of founders sharing their startup journey openly — wins, failures, and lessons." },
      { name: "Venture Tribe", tagline: "Entrepreneurs building the future", description: "Startup founders, angels, and operators sharing ideas, deals, and the founder experience." },
      { name: "First Principles", tagline: "Think from scratch, build what matters", description: "A founder community obsessed with first-principles thinking, lean building, and big ideas." },
      { name: "The Bootstrappers", tagline: "Profitable, not VC-dependent", description: "Self-funded founders sharing sustainable business strategies, growth hacks, and the bootstrapper mindset." },
      { name: "Co-Founder Connect", tagline: "Great companies need great co-founders", description: "A matchmaking and community space for founders seeking technical, creative, or operational partners." },
      { name: "Runway Crew", tagline: "Extend the runway, build the business", description: "Startup operators managing growth, funding, and strategy — sharing knowledge to go further." },
    ],
  },

  // ── Campus ─────────────────────────────────────────────────────────────────
  {
    categoryName: "campus_events",
    placeholders: [
      { name: "Campus Happenings", tagline: "Never miss a campus event", description: "Stay updated on campus events, concerts, lectures, and social gatherings at your university." },
      { name: "Event Alert", tagline: "Your campus social calendar", description: "Real-time updates on the best campus events, parties, performances, and activities near you." },
      { name: "What's On Campus", tagline: "Because boredom is not an option", description: "A comprehensive campus event guide — from major concerts to quiet film screenings and everything between." },
      { name: "The Campus Feed", tagline: "Your weekend starts here", description: "Curated event roundups, ticket sharing, and campus happenings for the well-connected student." },
      { name: "Campus Social", tagline: "Be where the action is", description: "The go-to source for campus parties, cultural events, guest lectures, and student activities." },
      { name: "Event Seekers", tagline: "Find your next campus memory", description: "Students connecting over events, sharing tickets, and coordinating attendance at campus activities." },
      { name: "Quad Life", tagline: "Life happens outside the lecture hall", description: "Social events, outdoor activities, and campus fun for students who love a vibrant campus life." },
      { name: "This Week on Campus", tagline: "Weekly campus event highlights", description: "A weekly roundup of campus events, must-attend activities, and social opportunities near you." },
      { name: "Student Scene", tagline: "Campus life at its best", description: "The student-run guide to the best campus events, clubs, and social activities this semester." },
      { name: "Campus Pulse", tagline: "Feel the heartbeat of campus life", description: "Your real-time connection to everything happening on campus — events, activities, and social scenes." },
    ],
  },
  {
    categoryName: "clubs",
    placeholders: [
      { name: "Campus Club Hub", tagline: "Find your people on campus", description: "Discover and join student clubs, organizations, and interest groups at your university." },
      { name: "Club Connect", tagline: "Every interest has a club", description: "An index of campus clubs helping students find communities that match their passions and goals." },
      { name: "Join the Club", tagline: "There's a club for everyone", description: "Browse campus organizations, meet club leaders, and find the extracurricular activities you love." },
      { name: "Club Life", tagline: "Your identity outside the classroom", description: "Student organizations, hobby clubs, professional associations, and interest groups all in one place." },
      { name: "The Club Board", tagline: "Post it, find it, join it", description: "A discovery tool for campus clubs — post openings, find new members, and grow your community." },
      { name: "Student Organizations", tagline: "Official and unofficial campus communities", description: "Connect with recognized student organizations and find clubs in every area of interest." },
      { name: "Club Rush", tagline: "Explore everything campus has to offer", description: "A year-round resource for students exploring the hundreds of clubs and organizations on campus." },
      { name: "Interest Groups", tagline: "Niche is not a dirty word", description: "Find your niche campus community — however specific your interests, there's a group for you." },
      { name: "Campus Communities", tagline: "Where belonging happens", description: "Student-led clubs and organizations creating spaces of belonging for every identity and interest." },
      { name: "The Club Scene", tagline: "Campus extracurriculars made easy", description: "Navigate the campus club landscape — find, join, and engage with student organizations near you." },
    ],
  },
  {
    categoryName: "study_groups",
    placeholders: [
      { name: "Study Squad", tagline: "Learn better together", description: "Form study groups for classes, share notes, and prepare for exams with fellow students." },
      { name: "The Library", tagline: "Quiet, focused, collaborative", description: "Organized study sessions, note-sharing, and academic support for students who study better together." },
      { name: "Brain Trust", tagline: "Smarter together", description: "Academic collaboration, exam prep, and study group formation for courses across all departments." },
      { name: "Group Think", tagline: "Two heads are better than one", description: "Study groups, problem sets, and peer tutoring for students who believe in collaborative learning." },
      { name: "Exam Season Crew", tagline: "Survive finals together", description: "Intensive study sessions, flashcard sharing, and academic moral support during exam season." },
      { name: "The Study Hall", tagline: "Every subject needs a study group", description: "Find study partners for any class, coordinate sessions, and share academic resources campus-wide." },
      { name: "Course Companions", tagline: "Find your class crew", description: "Connect with classmates, share lecture notes, and build study groups for any course or program." },
      { name: "Academic Alliance", tagline: "Serious students, shared goals", description: "A rigorous study community for high-achieving students looking for focused, productive study partners." },
      { name: "Flashcard Friends", tagline: "Memorize more, stress less", description: "Shared flashcard decks, study timers, and encouraging study partners for every class and exam." },
      { name: "Note Sharers", tagline: "Your notes plus my notes equals an A", description: "Collaborative note-taking, study guide creation, and exam prep for students who study smart." },
    ],
  },
  {
    categoryName: "intramural_sports",
    placeholders: [
      { name: "Campus Athletes", tagline: "Compete and have fun", description: "Join intramural teams, find practice partners, and compete in campus sports leagues." },
      { name: "Intramural Nation", tagline: "Every student can compete", description: "Find your sport, form your team, and compete in organized campus intramural leagues all year." },
      { name: "Team Up", tagline: "Athletes wanted: all levels welcome", description: "Intramural sports recruitment — find teammates for soccer, basketball, volleyball, flag football, and more." },
      { name: "Campus Competitors", tagline: "Play hard, study harder", description: "Recreational sports leagues for students who want friendly competition without going pro." },
      { name: "The B-League", tagline: "Where legends are made in gym class", description: "Intramural leagues for students who take the game seriously... at least on game day." },
      { name: "Rec Sports Crew", tagline: "Campus life needs more game days", description: "Intramural sports organization, team building, and game scheduling for all campus sports leagues." },
      { name: "All Campus Games", tagline: "Sport for every student", description: "A multi-sport intramural community running leagues in everything from dodgeball to ultimate frisbee." },
      { name: "Pickup on Campus", tagline: "Drop in and play", description: "Informal pickup games alongside official intramural leagues — always a game happening somewhere." },
      { name: "Weekend Warriors Campus", tagline: "Win the weekend, win the season", description: "Campus intramural leagues for students who bring their competitive best to weekend sports." },
      { name: "Team Spirit", tagline: "Play your sport, represent your college", description: "Intramural teams competing for campus glory — find your sport, build your team, win your league." },
    ],
  },
  {
    categoryName: "greek_life",
    placeholders: [
      { name: "Greek Connect", tagline: "Brotherhood and sisterhood", description: "Connect with members of fraternities and sororities, plan events, and build lifelong bonds." },
      { name: "The Greek Community", tagline: "More than letters on a sweatshirt", description: "A space for Greek life members to connect across chapters, plan philanthropy, and celebrate bonds." },
      { name: "Chapter & Chapter", tagline: "United by Greek life", description: "Cross-chapter networking, philanthropy coordination, and community for the Greek campus community." },
      { name: "Letters & Legacy", tagline: "Building on what came before", description: "Greek organizations sharing traditions, values, philanthropy initiatives, and alumni connections." },
      { name: "Panhellenic Hub", tagline: "All Greek, one community", description: "A resource center for sorority and fraternity members across all councils on campus." },
      { name: "Greek Social", tagline: "Events, connections, brotherhood, sisterhood", description: "Social events, philanthropies, and Greek life coordination for an active campus Greek community." },
      { name: "Rush & Connect", tagline: "Start your Greek journey here", description: "Information, meetups, and community for students exploring Greek life and considering joining." },
      { name: "Pledge to Purpose", tagline: "Membership with meaning", description: "Greek life events focused on philanthropy, community service, and making a meaningful difference." },
      { name: "Alumni Bridge", tagline: "Greek forever, connected always", description: "Connecting active Greek members with alumni for mentorship, networking, and lifelong brotherhood." },
      { name: "The Greek Life", tagline: "Bonds built for life", description: "Chapter events, philanthropy drives, and social connections across your campus Greek community." },
    ],
  },
];

export async function seedCategoryPlaceholders() {
  const allCategories = await db.select({ id: categories.id, name: categories.name }).from(categories);
  const categoryMap = new Map(allCategories.map(c => [c.name, c.id]));

  const existingCount = await db.select({ id: categoryPlaceholders.id }).from(categoryPlaceholders);
  const EXPECTED_ROWS = 1200; // 40 subcategories × 10 sets × 3 fields
  if (existingCount.length >= EXPECTED_ROWS) {
    console.log("[SEED] Category placeholders already fully seeded, skipping.");
    return;
  }
  if (existingCount.length > 0) {
    console.log(`[SEED] Found ${existingCount.length} placeholder rows (expected ${EXPECTED_ROWS}), clearing and reseeding...`);
    await db.delete(categoryPlaceholders);
  }

  let inserted = 0;
  for (const cat of placeholderData) {
    const categoryId = categoryMap.get(cat.categoryName);
    if (!categoryId) {
      console.warn(`[SEED] Category not found: ${cat.categoryName}`);
      continue;
    }
    for (let i = 0; i < cat.placeholders.length; i++) {
      const p = cat.placeholders[i];
      await db.insert(categoryPlaceholders).values([
        { categoryId, fieldType: "name", value: p.name, displayOrder: i },
        { categoryId, fieldType: "tagline", value: p.tagline, displayOrder: i },
        { categoryId, fieldType: "description", value: p.description, displayOrder: i },
      ]);
      inserted += 3;
    }
  }

  console.log(`[SEED] Category placeholders seeded: ${inserted} rows (${inserted / 3} sets across ${placeholderData.length} subcategories)`);
}
