export const EASY_TOPICS = [
    "Dinosaurs", "Dogs", "Cats", "Colors", "Shapes", "Numbers", "Apples", "Bananas",
    "Space", "Sun", "Moon", "Stars", "Fish", "Sharks", "Whales", "Birds", 
    "Penguins", "Bears", "Lions", "Tigers", "Elephants", "Monkeys", "Frogs", "Turtles",
    "Trees", "Flowers", "Grass", "Rain", "Snow", "Wind", "Clouds", "Cars", 
    "Trains", "Airplanes", "Boats", "Bicycles", "Firetrucks", "Police Cars", "Tractors", "Farm Animals",
    "Cows", "Pigs", "Horses", "Chickens", "Ducks", "Pond Life", "Insects", "Butterflies", 
    "Bees", "Spiders", "Ants", "Worms", "Robots", "Superheroes", "Princesses", "Knights", 
    "Dragons", "Castles", "Pirates", "Treasure", "Music", "Dancing", "Singing", "Painting",
    "Drawing", "Reading", "Writing", "Blocks", "Puzzles", "Games", "Toys", "Balloons"
]; // 72 topics

export const MEDIUM_TOPICS = [
    "Solar System", "Planets", "Mars", "Jupiter", "Saturn", "Black Holes", "Asteroids", "Comets",
    "Volcanoes", "Earthquakes", "Tornadoes", "Hurricanes", "Oceans", "Coral Reefs", "Deep Sea", "Deserts",
    "Rainforests", "Mountains", "Caves", "Glaciers", "Ancient Egypt", "Pyramids", "Mummies", "Ancient Rome",
    "Gladiators", "Ancient Greece", "Olympics", "Mythology", "Viking Ships", "Medieval Times", "Castles", "Knights",
    "Samurai", "Ninjas", "Explorers", "Pirate Ships", "Treasure Maps", "Inventions", "Electricity", "Magnets",
    "Gravity", "Light", "Sound", "States of Matter", "Chemical Reactions", "Human Body", "Bones", "Muscles",
    "Heart", "Brain", "Lungs", "Digestive System", "Five Senses", "DNA", "Cells", "Microbes",
    "Viruses", "Bacteria", "Medicines", "Vaccines", "Computers", "Coding", "Internet", "Artificial Intelligence",
    "Virtual Reality", "Video Games", "Animation", "Movies", "Photography", "Music Genres", "Instruments", "Orchestras"
]; // 72 topics

export const HARD_TOPICS = [
    "Quantum Physics", "Theory of Relativity", "String Theory", "Dark Matter", "Dark Energy", "Multiverse", "Astrophysics", "Cosmology",
    "Thermodynamics", "Electromagnetism", "Fluid Dynamics", "Aerodynamics", "Organic Chemistry", "Inorganic Chemistry", "Biochemistry", "Molecular Biology",
    "Genetics", "Epigenetics", "Evolution", "Paleontology", "Geology", "Meteorology", "Climatology", "Oceanography",
    "Ecology", "Botany", "Zoology", "Entomology", "Marine Biology", "Neuroscience", "Psychology", "Sociology",
    "Anthropology", "Archaeology", "Linguistics", "Philosophy", "Ethics", "Logic", "Epistemology", "Metaphysics",
    "Economics", "Macroeconomics", "Microeconomics", "Political Science", "International Relations", "History of Art", "Renaissance", "Impressionism",
    "Cubism", "Surrealism", "Classical Music", "Baroque Music", "Romantic Music", "Jazz History", "Rock and Roll History", "Hip Hop History",
    "World War I", "World War II", "Cold War", "Industrial Revolution", "French Revolution", "American Revolution", "Civil Rights Movement", "Space Race",
    "Computer Architecture", "Data Structures", "Algorithms", "Cryptography", "Machine Learning", "Neural Networks", "Blockchain"
]; // 71 topics

export const getTopicsForDifficulty = (difficulty) => {
    switch (difficulty) {
        case 'Easy': return EASY_TOPICS;
        case 'Medium': return MEDIUM_TOPICS;
        case 'Hard': return HARD_TOPICS;
        default: return EASY_TOPICS;
    }
};

export const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};
