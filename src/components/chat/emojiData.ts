/**
 * Emoji catalogue for the reaction picker. Each entry is "<emoji> <search words…>",
 * entries separated by "|". Parsed once at import.
 */

export type EmojiCategoryKey =
  | 'smileys'
  | 'animals'
  | 'food'
  | 'activities'
  | 'travel'
  | 'objects'
  | 'symbols'
  | 'flags';

export type EmojiEntry = { emoji: string; keywords: string };
export type EmojiCategory = {
  key: EmojiCategoryKey;
  title: string;
  emojis: EmojiEntry[];
};

const RAW: Record<EmojiCategoryKey, [string, string]> = {
  smileys: [
    'Smileys & people',
    '😀 grinning smile happy|😃 smiley happy|😄 smile happy|😁 grin|😆 laughing|😅 sweat smile|🤣 rofl laugh|😂 joy laugh tears|🙂 slight smile|🙃 upside down|😉 wink|😊 blush|😇 angel halo|🥰 love hearts|😍 heart eyes love|🤩 star struck|😘 kiss|😗 kissing|😚 kiss closed|😙 kiss smile|😋 yum tasty|😛 tongue|😜 wink tongue|🤪 crazy zany|😝 squint tongue|🤑 money|🤗 hug|🤭 oops giggle|🤫 shush quiet|🤔 thinking|🤐 zipper mouth|🤨 raised eyebrow|😐 neutral|😑 expressionless|😶 no mouth|😏 smirk|😒 unamused|🙄 eye roll|😬 grimace|😌 relieved|😔 pensive|😪 sleepy|🤤 drool|😴 sleeping|😷 mask sick|🤒 fever sick|🤕 hurt|🤢 nauseated|🤮 vomit|🥵 hot|🥶 cold|🥴 woozy|😵 dizzy|🤯 mind blown|🤠 cowboy|🥳 party celebrate|😎 cool sunglasses|🤓 nerd|🧐 monocle|😕 confused|😟 worried|🙁 frown|😮 wow open mouth surprised|😯 hushed|😲 astonished shocked|😳 flushed|🥺 pleading puppy|😦 frowning|😧 anguished|😨 fearful|😰 anxious|😥 sad relieved|😢 cry sad tear|😭 sob crying|😱 scream|😖 confounded|😣 persevere|😞 disappointed|😓 sweat|😩 weary|😫 tired|🥱 yawn|😤 triumph huff|😡 angry rage|😠 mad angry|🤬 cursing|😈 devil|💀 skull dead|☠️ skull crossbones|💩 poop|🤡 clown|👻 ghost|👽 alien|🤖 robot|😺 cat smile|😹 cat joy|😻 cat heart|🙈 see no evil monkey|🙉 hear no evil|🙊 speak no evil|👋 wave hello|🤚 raised back hand|✋ hand stop|🖐️ hand fingers|👌 ok|🤌 pinched|✌️ victory peace|🤞 crossed fingers luck|🤟 love you|🤘 rock|🤙 call me|👈 left|👉 right|👆 up|👇 down|👍 thumbs up like yes|👎 thumbs down dislike no|✊ fist|👊 punch|👏 clap|🙌 raise hands|👐 open hands|🤲 palms|🤝 handshake|🙏 pray please thanks|💪 muscle strong|🧠 brain|👀 eyes look|💋 kiss lips|🙇 bow|🤦 facepalm|🤷 shrug|🙆 ok person|🙅 no person|💁 tipping hand|🙋 raising hand|👶 baby|🧒 child|👦 boy|👧 girl|🧑 person|👨 man|👩 woman|👴 old man|👵 old woman|👮 police|👷 worker|💂 guard|👨‍💻 coder developer|👩‍💻 coder developer|👨‍🍳 cook chef|🧑‍🎓 student|🧑‍🏫 teacher|👼 baby angel|🎅 santa|🦸 superhero|🧙 wizard|🧛 vampire|🧟 zombie|💃 dance|🕺 dance man|👯 party|🧘 yoga|🏃 run|🚶 walk|👫 couple|💑 couple love|👪 family|🗣️ speaking',
  ],
  animals: [
    'Animals & nature',
    '🐶 dog|🐱 cat|🐭 mouse|🐹 hamster|🐰 rabbit bunny|🦊 fox|🐻 bear|🐼 panda|🐨 koala|🐯 tiger|🦁 lion|🐮 cow|🐷 pig|🐸 frog|🐵 monkey|🐔 chicken|🐧 penguin|🐦 bird|🐤 chick|🦆 duck|🦅 eagle|🦉 owl|🦇 bat|🐺 wolf|🐴 horse|🦄 unicorn|🐝 bee|🐛 bug|🦋 butterfly|🐌 snail|🐞 ladybug|🐜 ant|🕷️ spider|🐢 turtle|🐍 snake|🦎 lizard|🐙 octopus|🦀 crab|🐠 tropical fish|🐟 fish|🐬 dolphin|🐳 whale|🦈 shark|🐊 crocodile|🐆 leopard|🦓 zebra|🦍 gorilla|🐘 elephant|🦒 giraffe|🐪 camel|🐐 goat|🐑 sheep|🦜 parrot|🦚 peacock|🕊️ dove peace|🐿️ squirrel|🌵 cactus|🎄 christmas tree|🌲 evergreen tree|🌳 tree|🌴 palm|🌱 seedling|🌿 herb|🍀 clover luck|🍁 maple leaf|🍂 leaves autumn|🌷 tulip|🌹 rose|🥀 wilted flower|🌺 hibiscus|🌸 blossom|🌼 flower|🌻 sunflower|🌞 sun face|🌝 moon face|🌚 new moon|🌙 crescent moon|⭐ star|🌟 glowing star|✨ sparkles|⚡ lightning|🔥 fire lit|🌈 rainbow|☀️ sun|⛅ cloud sun|☁️ cloud|🌧️ rain|⛈️ storm|❄️ snow|☃️ snowman|🌊 wave ocean|💧 drop|☔ umbrella rain',
  ],
  food: [
    'Food & drink',
    '🍏 green apple|🍎 apple|🍐 pear|🍊 orange|🍋 lemon|🍌 banana|🍉 watermelon|🍇 grapes|🍓 strawberry|🍈 melon|🍒 cherries|🍑 peach|🥭 mango|🍍 pineapple|🥥 coconut|🥝 kiwi|🍅 tomato|🍆 eggplant|🥑 avocado|🥦 broccoli|🥒 cucumber|🌶️ chili hot|🌽 corn|🥕 carrot|🧄 garlic|🧅 onion|🥔 potato|🥐 croissant|🍞 bread|🧀 cheese|🥚 egg|🍳 cooking egg|🥞 pancakes|🍗 chicken leg|🍔 burger|🍟 fries|🍕 pizza|🥪 sandwich|🌮 taco|🌯 burrito|🥗 salad|🍝 pasta spaghetti|🍜 noodles ramen|🍲 stew|🍛 curry rice|🍣 sushi|🥟 dumpling|🍤 shrimp|🍚 rice|🍧 shaved ice|🍨 ice cream|🍦 soft serve|🥧 pie|🧁 cupcake|🍰 cake|🎂 birthday cake|🍮 custard|🍭 lollipop|🍬 candy|🍫 chocolate|🍿 popcorn|🍩 donut|🍪 cookie|🥜 peanuts|🍯 honey|🥛 milk|☕ coffee tea chai|🍵 tea|🧃 juice|🥤 soda|🧋 bubble tea|🍺 beer|🍻 cheers beers|🥂 cheers champagne|🍷 wine|🥃 whisky|🍸 cocktail|🍹 tropical drink|🍾 champagne|🧊 ice|🍴 fork knife|🍽️ plate',
  ],
  activities: [
    'Activities',
    '⚽ soccer football|🏀 basketball|🏈 american football|⚾ baseball|🎾 tennis|🏐 volleyball|🏉 rugby|🎱 billiards|🏓 ping pong|🏸 badminton|🏏 cricket|⛳ golf|🏹 archery|🎣 fishing|🥊 boxing|🥋 martial arts|🛹 skateboard|⛸️ ice skate|🎿 ski|🏂 snowboard|🏋️ weight lifting gym|🤸 cartwheel|🏊 swim|🚴 bike cycling|🏆 trophy win|🥇 gold medal first|🥈 silver medal|🥉 bronze medal|🏅 medal|🎗️ ribbon|🎫 ticket|🎪 circus|🎭 theater|🎨 art paint|🎬 movie clapper|🎤 mic sing|🎧 headphones music|🎹 piano|🥁 drum|🎷 saxophone|🎺 trumpet|🎸 guitar|🎻 violin|🎲 dice|♟️ chess|🎯 target bullseye|🎳 bowling|🎮 game controller|🕹️ joystick|🧩 puzzle|🎉 party popper celebrate|🎊 confetti|🎈 balloon|🎁 gift present|🎀 ribbon bow|🎆 fireworks|🎇 sparkler|🧨 firecracker|🪔 diya lamp diwali',
  ],
  travel: [
    'Travel & places',
    '🚗 car|🚕 taxi|🚙 suv|🚌 bus|🏎️ race car|🚓 police car|🚑 ambulance|🚒 fire engine|🚐 van|🚚 truck|🚜 tractor|🛵 scooter|🏍️ motorcycle bike|🚲 bicycle|🛴 kick scooter|🚨 siren|✈️ airplane flight|🛫 departure|🛬 arrival|🚀 rocket|🛸 ufo|🚁 helicopter|⛵ sailboat|🚤 speedboat|🚢 ship|⚓ anchor|🚂 train|🚇 metro|🗺️ map|🧭 compass|🏔️ mountain snow|⛰️ mountain|🌋 volcano|🏕️ camping|🏖️ beach|🏜️ desert|🏝️ island|🏞️ park|🏟️ stadium|🏠 house home|🏡 house garden|🏢 office|🏥 hospital|🏦 bank|🏨 hotel|🏫 school|🏰 castle|💒 wedding|🗼 tower|🗽 statue liberty|🕌 mosque|🛕 temple mandir|⛪ church|⛲ fountain|🌃 night city|🏙️ cityscape|🌄 sunrise mountains|🌅 sunrise|🌇 sunset|🌉 bridge night|🎡 ferris wheel|🎢 roller coaster|⛽ fuel|🚦 traffic light|🗿 moai|🌍 earth globe world|🌏 globe asia|⌛ hourglass|⏰ alarm clock',
  ],
  objects: [
    'Objects',
    '⌚ watch|📱 phone mobile|💻 laptop computer|⌨️ keyboard|🖥️ desktop|🖨️ printer|💾 floppy|💿 cd|📷 camera|📸 camera flash photo|📹 video camera|🎥 movie camera|📞 telephone|📺 tv|📻 radio|🎙️ microphone|⏱️ stopwatch|🔋 battery|🔌 plug|💡 bulb idea|🔦 flashlight|🕯️ candle|💸 money flying|💵 dollar|💰 money bag|💳 card|💎 gem diamond|⚖️ scales|🔧 wrench|🔨 hammer|🛠️ tools|⚙️ gear|💣 bomb|🔪 knife|🛡️ shield|🔮 crystal ball|📿 beads|🔭 telescope|🔬 microscope|💊 pill|💉 syringe|🧬 dna|🧹 broom|🛁 bath|🛏️ bed|🛋️ couch|🚪 door|🔑 key|🔒 lock|🔓 unlock|🧸 teddy bear|🖼️ picture frame|🛍️ shopping bags|🛒 cart|✉️ envelope|📦 package box|📝 memo note|📅 calendar|📌 pin|📎 paperclip|✂️ scissors|🖊️ pen|✏️ pencil|📚 books|📖 book|🔗 link|📣 megaphone|🔔 bell|🎵 music note|🎶 notes music|👓 glasses|🕶️ sunglasses|👔 tie|👕 tshirt|👖 jeans|👗 dress|🥻 saree sari|👠 heels|👟 sneaker|👑 crown king queen|🎩 top hat|🧢 cap|💍 ring|👜 handbag|🎒 backpack|☂️ umbrella',
  ],
  symbols: [
    'Symbols',
    '❤️ heart love red|🧡 orange heart|💛 yellow heart|💚 green heart|💙 blue heart|💜 purple heart|🖤 black heart|🤍 white heart|🤎 brown heart|💔 broken heart|❤️‍🔥 heart fire|❣️ heart exclamation|💕 two hearts|💞 revolving hearts|💓 beating heart|💗 growing heart|💖 sparkling heart|💘 cupid heart arrow|💝 heart ribbon|☮️ peace|🕉️ om|☯️ yin yang|♈ aries|♉ taurus|♊ gemini|♋ cancer|♌ leo|♍ virgo|♎ libra|♏ scorpio|♐ sagittarius|♑ capricorn|♒ aquarius|♓ pisces|💯 hundred perfect|💢 anger|💥 boom collision|💫 dizzy|💦 sweat drops|💨 dash|💬 speech bubble|💭 thought|💤 zzz sleep|✅ check done|✔️ check mark|❌ cross x no|➕ plus|➖ minus|♾️ infinity|‼️ double exclamation|⁉️ interrobang|❓ question|❗ exclamation|⚠️ warning|🚫 prohibited|⛔ no entry|🔞 eighteen|♻️ recycle|✳️ asterisk|❇️ sparkle|🌀 cyclone|🆗 ok|🆕 new|🆓 free|🆒 cool|🔝 top|🔜 soon|▶️ play|⏸️ pause|🔁 repeat|➡️ right arrow|⬅️ left arrow|⬆️ up arrow|⬇️ down arrow|🔊 loud|📢 loudspeaker|🔴 red circle|🟠 orange circle|🟡 yellow circle|🟢 green circle|🔵 blue circle|🟣 purple circle|⚫ black circle|⚪ white circle|🔶 orange diamond|🔷 blue diamond|🔺 red triangle|©️ copyright|®️ registered|™️ trademark',
  ],
  flags: [
    'Flags',
    '🏁 checkered race|🚩 red flag|🎌 crossed flags|🏴 black flag|🏳️ white flag|🏳️‍🌈 rainbow pride|🏴‍☠️ pirate|🇮🇳 india|🇺🇸 usa america|🇬🇧 uk britain|🇨🇦 canada|🇦🇺 australia|🇳🇿 new zealand|🇦🇪 uae dubai|🇸🇦 saudi arabia|🇵🇰 pakistan|🇧🇩 bangladesh|🇳🇵 nepal|🇱🇰 sri lanka|🇨🇳 china|🇯🇵 japan|🇰🇷 korea|🇸🇬 singapore|🇲🇾 malaysia|🇹🇭 thailand|🇮🇩 indonesia|🇵🇭 philippines|🇻🇳 vietnam|🇫🇷 france|🇩🇪 germany|🇮🇹 italy|🇪🇸 spain|🇵🇹 portugal|🇳🇱 netherlands|🇧🇪 belgium|🇨🇭 switzerland|🇸🇪 sweden|🇳🇴 norway|🇩🇰 denmark|🇫🇮 finland|🇮🇪 ireland|🇷🇺 russia|🇺🇦 ukraine|🇵🇱 poland|🇹🇷 turkey|🇬🇷 greece|🇪🇬 egypt|🇿🇦 south africa|🇳🇬 nigeria|🇰🇪 kenya|🇧🇷 brazil|🇦🇷 argentina|🇲🇽 mexico|🇨🇴 colombia|🇨🇱 chile|🇵🇪 peru|🇶🇦 qatar|🇰🇼 kuwait|🇴🇲 oman|🇮🇱 israel|🇦🇫 afghanistan',
  ],
};

function parse(raw: string): EmojiEntry[] {
  const seen = new Set<string>();
  const list: EmojiEntry[] = [];
  for (const part of raw.split('|')) {
    const space = part.indexOf(' ');
    const emoji = space < 0 ? part : part.slice(0, space);
    if (!emoji || seen.has(emoji)) continue;
    seen.add(emoji);
    list.push({ emoji, keywords: space < 0 ? '' : part.slice(space + 1) });
  }
  return list;
}

export const EMOJI_CATEGORIES: EmojiCategory[] = (
  Object.keys(RAW) as EmojiCategoryKey[]
).map(key => ({ key, title: RAW[key][0], emojis: parse(RAW[key][1]) }));

const ALL = EMOJI_CATEGORIES.flatMap(c => c.emojis);

/** Matches the start of any keyword ("hea" → hearts), or the emoji itself. */
export function searchEmojis(query: string, limit = 120): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of ALL) {
    if (seen.has(entry.emoji)) continue;
    const hit =
      entry.emoji === q ||
      entry.keywords.split(' ').some(word => word.startsWith(q)) ||
      (q.includes(' ') && entry.keywords.includes(q));
    if (hit) {
      seen.add(entry.emoji);
      out.push(entry.emoji);
      if (out.length >= limit) break;
    }
  }
  return out;
}
