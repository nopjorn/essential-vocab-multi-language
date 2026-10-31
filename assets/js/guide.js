// In-app user guide (คู่มือการเล่น). Update it whenever a feature changes.
// Each section: { id, icon (name in icons.js), color, title, items: [string | { b: bold, text }] }.
export const GUIDE = {
  th: [
    {
      id: 'start', icon: 'play', color: 'blue', title: 'เริ่มต้นใช้งาน',
      items: [
        'เปิดแอปครั้งแรกจะมีหน้าต้อนรับ 3 ขั้น ให้เลือกภาษาที่จะเรียน ระดับเริ่มต้น และเป้าหมายรายวัน (แตะ "ข้าม" เพื่อใช้ค่าเริ่มต้น)',
        'แถบเมนูด้านล่างมี: หน้าหลัก · ความคืบหน้า · ปุ่มเริ่มฝึก (วงกลมตรงกลาง) · คู่มือ · ตั้งค่า',
        'ในหน้าหลัก เลือกภาษาที่จะเรียน (อังกฤษ เกาหลี ญี่ปุ่น) จากแถบด้านบน',
        'ภาษาเกาหลีสำหรับมือใหม่ที่ยังอ่านฮันกึลไม่ได้: ระดับ 1 มี 5 ชุดแรกเป็นตัวอักษร (สระ พยัญชนะ พยัญชนะเสียงตึง สระประสม และคำง่ายๆ) แตะลำโพงเพื่อฟังเสียงของแต่ละตัว',
        'การ์ด "วันนี้" ในหน้าหลักแสดงวงแหวนเป้าหมายรายวัน และวันเรียนต่อเนื่อง แตะ "เล่นต่อ" เพื่อเริ่มรอบปกติ หรือ "เล่นด่วน 5 คำ" สำหรับรอบสั้น ๆ ไม่กี่นาที แถบล่างของการ์ดบอกจำนวนคำที่จำได้และความแม่นยำ แตะเพื่อดูรายละเอียด',
        'การ์ด "แนะนำต่อไป" เลือกชุดคำศัพท์ที่ควรเรียนต่อให้อัตโนมัติ แตะเพื่อฝึกชุดนั้นได้ทันที (ไม่เปลี่ยนชุดที่เลือกไว้)',
        'คำศัพท์แต่ละภาษามีประมาณ 3,000 คำ แบ่งเป็น 3 ระดับ: ระดับ 1 พื้นฐาน · ระดับ 2 ชีวิตประจำวัน · ระดับ 3 ต่อยอด แตะแถบระดับเหนือรายการชุดคำศัพท์เพื่อสลับ (เลือกชุดจากหลายระดับพร้อมกันได้)',
        'เลือกโหมดเกม แล้วแตะชุดคำศัพท์ที่อยากฝึก (เลือกได้หลายชุด เครื่องหมายถูกด้านขวาคือชุดที่เลือกแล้ว) ชุดที่จำได้ครบทุกคำจะมีมงกุฎสีทอง',
        'ช่องค้นหาเหนือรายการชุดคำศัพท์ ค้นได้ทั้งชื่อชุดและคำศัพท์ข้างใน (เช่น พิมพ์ "แมว" เพื่อหาชุดที่มีคำนี้) ค้นทุกระดับพร้อมกัน',
        'แตะไอคอนรายการ (☰) ที่ท้ายแถวของชุดคำศัพท์เพื่อดูคำทั้งหมดในชุด พร้อมคำอ่าน คำแปล และปุ่มฟังเสียง แตะวงกลมที่ท้ายคำเพื่อทำเครื่องหมายว่า "รู้คำนี้แล้ว" (แตะอีกครั้งเพื่อยกเลิก) และแตะ "ฝึกชุดนี้" เพื่อเล่นเฉพาะชุดนั้น',
        'แตะปุ่ม "เริ่มฝึก" ตรงกลางแถบเมนูด้านล่าง กดได้จากทุกหน้า แอปจะเริ่มด้วยภาษา โหมด และชุดคำศัพท์ที่เลือกไว้ล่าสุด',
        'เกมเปิดเต็มจอ แตะ ✕ มุมซ้ายบนเพื่อออก เมื่อจบเกมจะกลับไปหน้าที่เปิดอยู่ก่อนเริ่ม',
        'แตะไอคอนลำโพงเพื่อฟังเสียงอ่านได้ทุกที่',
      ],
    },
    {
      id: 'modes', icon: 'flash', color: 'indigo', title: 'โหมดเกม',
      items: [
        { b: 'ผสมทุกโหมด (แนะนำ)', text: 'สลับโหมดให้ทุกข้อ ทั้งเลือกความหมาย เลือกคำศัพท์ ฟังแล้วตอบ และพิมพ์คำศัพท์ (คำที่เริ่มจำได้แล้วจึงจะมีโหมดพิมพ์) ป้ายเหนือคำถามบอกว่าข้อนั้นเป็นโหมดไหน' },
        { b: 'แฟลชการ์ด', text: 'แตะการ์ดเพื่อพลิกดูความหมาย แล้วปัดขวาถ้าจำได้ หรือปัดซ้ายถ้ายังจำไม่ได้ (หรือแตะปุ่ม ✓ / ✕ ใต้การ์ด) ถ้าปัดผิด แตะปุ่มย้อน ↶ มุมขวาบนเพื่อย้อนการ์ดใบก่อน' },
        { b: 'เลือกความหมาย', text: 'ดูคำศัพท์ แล้วเลือกคำแปลที่ถูกจาก 4 ตัวเลือก' },
        { b: 'เลือกคำศัพท์', text: 'ดูคำแปล แล้วเลือกคำศัพท์ที่ถูก' },
        { b: 'ฟังแล้วตอบ', text: 'ฟังเสียง แล้วเลือกคำแปล (แตะลำโพงเพื่อฟังซ้ำ)' },
        { b: 'พิมพ์คำศัพท์', text: 'ดูคำแปล แล้วพิมพ์คำศัพท์ ภาษาเกาหลีพิมพ์ฮันกึลหรือโรมันได้ ภาษาญี่ปุ่นพิมพ์คันจิ คานะ หรือโรมาจิได้ (เช่น ohayou หรือ ohayo) แตะ "คำใบ้" เพื่อดูตัวอักษรแรกและจำนวนตัวอักษร' },
        { b: 'จับคู่', text: 'แตะคำศัพท์ทางซ้าย แล้วแตะคำแปลทางขวาให้ตรงกัน รอบละ 6 คู่ ถ้าจับผิดคำนั้นจะนับว่ายังจำไม่ได้ มีนาฬิกาจับเวลาแต่ละรอบ ทำเวลาดีกว่าสถิติเดิมจะขึ้น "สถิติใหม่!"' },
        { b: 'คอมโบ', text: 'ตอบถูกติดกันตั้งแต่ 2 ข้อจะมีตัวนับคอมโบ 🔥 ที่แถบด้านบน ทุก 5 ข้อมีเอฟเฟกต์พิเศษ ตอบผิดคอมโบจะเริ่มใหม่' },
        { b: 'เสียงประกอบ', text: 'มีเสียงเมื่อตอบถูก ตอบผิด และทำคอมโบ ปิดได้ที่ ตั้งค่า › เสียงประกอบ' },
      ],
    },
    {
      id: 'srs', icon: 'repeat', color: 'green', title: 'ระบบทบทวนอัจฉริยะ',
      items: [
        'ทุกคำมีระดับความจำ 0–5 ตอบถูกระดับจะขึ้นทีละ 1 ตอบผิดจะกลับไปที่ 0',
        'คำที่อยู่ระดับ 3 ขึ้นไปนับว่า "จำได้แล้ว"',
        'เกมจะสุ่มคำที่ยังไม่เคยเห็นและคำที่ยังจำไม่ได้มาให้บ่อยกว่า',
        'จบเกมแล้วแตะ "ฝึกคำที่ผิดอีกครั้ง" เพื่อทบทวนเฉพาะคำที่พลาด',
        'หน้าสรุปผลบอกคำที่เพิ่งจำได้ เทียบความแม่นยำกับรอบก่อน ความคืบหน้าของเป้าหมายรายวัน คอมโบสูงสุด สถิติใหม่ และตราที่เพิ่งได้รับ',
      ],
    },
    {
      id: 'progress', icon: 'progress', color: 'orange', title: 'ดูความคืบหน้า',
      items: [
        'แถบล่างของการ์ด "วันนี้" ในหน้าหลักบอกจำนวนคำที่จำได้และความแม่นยำของภาษาที่เลือก แตะเพื่อดูรายละเอียด',
        'แท็บ "ความคืบหน้า" แสดงภาพรวมทุกภาษา และกราฟจำนวนคำตอบ 14 วันล่าสุด (แตะแท่งกราฟเพื่อดูตัวเลข)',
        'เลือกภาษาด้านบนเพื่อดูความคืบหน้าแยกชุด (จัดกลุ่มตามระดับ) คำที่ผิดบ่อย (แตะ "ฝึกคำเหล่านี้" ได้ทันที) และประวัติการเล่น',
        'ตราสะสม: เรียนต่อเนื่อง 3/7/30 วัน จำได้ 50/200/500/1000 คำ จำครบ 1/10 ชุด และคอมโบ ×10/×25 ตราที่ยังไม่ได้จะเป็นสีเทาพร้อมบอกความคืบหน้า',
      ],
    },
    {
      id: 'settings', icon: 'settings', color: 'gray', title: 'การตั้งค่า',
      items: [
        'ภาษาคำแปลและภาษาของแอป: ไทย หรือ English',
        'จำนวนข้อต่อรอบ: 10, 20, 30 หรือทั้งหมด',
        'เป้าหมายรายวัน: 10, 20, 50 หรือ 100 คำตอบต่อวัน (ค่าเริ่มต้น 20)',
        'แสดงคำอ่าน (คานะและอักษรโรมัน) ออกเสียงอัตโนมัติ และเสียงประกอบ (เสียงตอบถูก/ผิด/คอมโบ)',
        'ธีม: ตามระบบ (ค่าเริ่มต้น) สว่าง หรือ มืด',
        'ส่งออกความคืบหน้าเป็นไฟล์สำรอง .json และนำเข้ากลับ (รวมกับข้อมูลในเครื่อง ไม่ทับคำตอบที่ใหม่กว่า) ใช้ย้ายเครื่องได้',
        'ล้างความคืบหน้าแยกตามภาษา และดูเวอร์ชันกับรายการ "มีอะไรใหม่"',
      ],
    },
    {
      id: 'install', icon: 'share', color: 'teal', title: 'เพิ่มไปยังหน้าจอโฮม (iPhone / iPad)',
      items: [
        { b: '1.', text: 'เปิดแอปนี้ใน Safari' },
        { b: '2.', text: 'แตะปุ่ม แชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) บน iPhone อยู่แถบล่าง บน iPad อยู่มุมขวาบน ถ้าไม่เห็นให้แตะปุ่ม ••• ก่อน' },
        { b: '3.', text: 'เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม"' },
        { b: '4.', text: 'เปิด "เปิดเป็นเว็บแอป" ไว้ แล้วแตะ "เพิ่ม"' },
        'จากนั้นเปิดจากไอคอนบนหน้าโฮม แอปจะแสดงเต็มจอ ไม่มีแถบ Safari และใช้งานออฟไลน์ได้',
      ],
    },
    {
      id: 'voice', icon: 'speaker', color: 'orange', title: 'เสียงอ่าน',
      items: [
        'ใช้เสียงที่มีในเครื่อง ถ้าไม่มีเสียง ให้ไปที่ การตั้งค่า › การช่วยการเข้าถึง › เนื้อหาที่พูด › เสียง แล้วดาวน์โหลดเสียงภาษาที่เรียน',
        'ถ้าไม่ได้ยินเสียง ให้ตรวจว่าสวิตช์ปิดเสียงไม่ได้เปิดอยู่ และเพิ่มระดับเสียงขึ้น',
      ],
    },
    {
      id: 'keys', icon: 'keyboard', color: 'indigo', title: 'คีย์ลัด (iPad ที่ต่อคีย์บอร์ด)',
      items: [
        { b: '1–4', text: 'เลือกคำตอบ' },
        { b: 'Enter / Space', text: 'ไปข้อต่อไป หรือพลิกการ์ด' },
        { b: '← / →', text: 'ในโหมดแฟลชการ์ด ใช้แทนการปัดซ้าย (ยังจำไม่ได้) และปัดขวา (จำได้)' },
        { b: 'Z / Backspace', text: 'ในโหมดแฟลชการ์ด ย้อนการ์ดใบก่อน' },
      ],
    },
    {
      id: 'about', icon: 'info', color: 'gray', title: 'ข้อมูลและลิขสิทธิ์',
      items: [
        'คำศัพท์ทั้งหมดเขียนขึ้นใหม่และเผยแพร่แบบ CC0 (สาธารณสมบัติ) จึงใช้ได้ฟรี รวมถึงเชิงพาณิชย์',
        'ไม่ได้คัดลอกจากรายการคำศัพท์ที่มีลิขสิทธิ์หรือมีเงื่อนไข เช่น Oxford 3000, NGSL หรือรายการคำของ TOPIK/JLPT',
        'ความคืบหน้าเก็บไว้ในเครื่องนี้เท่านั้น',
        'ดูสิ่งที่เปลี่ยนในแต่ละเวอร์ชันได้ที่ ตั้งค่า › มีอะไรใหม่',
      ],
    },
  ],
  en: [
    {
      id: 'start', icon: 'play', color: 'blue', title: 'Getting started',
      items: [
        'The first time you open the app, a 3-step welcome asks for the language to learn, a starting level and a daily goal (tap "Skip" to use the defaults)',
        'The tab bar at the bottom has: Home · Progress · the Start button (round, in the middle) · Guide · Settings',
        'On Home, choose the language to learn (English, Korean, Japanese) at the top',
        'Korean for complete beginners who cannot read Hangul yet: the first 5 sets of level 1 teach the letters (vowels, consonants, tense consonants, compound vowels and easy words). Tap the speaker to hear each letter',
        'The "Today" card on Home shows your daily goal ring and day streak. Tap "Continue" for a normal round, or "Quick 5" for a short round of a few minutes. Its bottom row shows words mastered and accuracy; tap it for details',
        'The "Up next" card picks the word set to learn next for you; tap it to practice that set right away (your selection stays as it is)',
        'Each language has about 3,000 words in 3 levels: 1 Beginner · 2 Everyday · 3 Intermediate. Switch levels with the bar above the word sets (you can pick sets from several levels at once)',
        'Choose a game mode, then tap the word sets you want (several at once; a check mark means selected). Fully mastered sets wear a gold crown',
        'The search box above the word sets finds set names and the words inside them (e.g. type "cat" to find the set that has it), across all levels',
        'Tap the list icon (☰) at the end of a word-set row to see every word in it, with reading, translation and a speaker button. Tap the circle at the end of a word to mark it "I know this word" (tap again to undo). Tap "Practice this set" to play only that set',
        'Tap "Start" in the middle of the tab bar, from any screen. It uses the language, mode and sets you chose last',
        'The game opens full screen; tap ✕ at the top left to leave. When it ends you go back to the screen you started from',
        'Tap the speaker icon anywhere to hear the pronunciation',
      ],
    },
    {
      id: 'modes', icon: 'flash', color: 'indigo', title: 'Game modes',
      items: [
        { b: 'Mixed (suggested)', text: 'A different mode every question: pick the meaning, pick the word, listen, and type (typing only for words you are starting to know). A label above the question shows its mode' },
        { b: 'Flashcards', text: 'Tap the card to flip it, then swipe right if you knew it or left if not (or tap ✓ / ✕ below the card). Swiped the wrong way? Tap undo ↶ at the top right to bring back the last card' },
        { b: 'Pick the meaning', text: 'See the word, choose its translation from 4 options' },
        { b: 'Pick the word', text: 'See the translation, choose the word' },
        { b: 'Listen & answer', text: 'Listen, then choose the translation (tap the speaker to replay)' },
        { b: 'Type the word', text: 'See the translation, type the word. Korean accepts Hangul or romanization; Japanese accepts kanji, kana or romaji (e.g. ohayou or ohayo). Tap "Hint" to see the first letter and the word length' },
        { b: 'Match pairs', text: 'Tap a word on the left, then its translation on the right. 6 pairs per round; a wrong match counts the word as not yet learned. Each round is timed; beat your best time for a "New record!"' },
        { b: 'Combo', text: 'Two or more correct answers in a row show a 🔥 combo counter at the top, with a burst every 5. A wrong answer starts it over' },
        { b: 'Sound effects', text: 'Sounds play for right and wrong answers and combos. Turn them off in Settings › Sound effects' },
      ],
    },
    {
      id: 'srs', icon: 'repeat', color: 'green', title: 'Smart review',
      items: [
        'Every word has a memory level 0–5. A correct answer moves it up one level; a wrong one sends it back to 0',
        'Words at level 3 or higher count as "mastered"',
        'New and weak words come up more often',
        'After a game, tap "Practice mistakes" to review only the words you missed',
        'The results screen shows newly mastered words, your accuracy compared with the last game, daily-goal progress, your best combo, new records and newly earned badges',
      ],
    },
    {
      id: 'progress', icon: 'progress', color: 'orange', title: 'Tracking progress',
      items: [
        'The bottom row of the "Today" card on Home shows words mastered and accuracy for the chosen language; tap it for details',
        'The Progress tab shows all languages and answers over the last 14 days (tap a bar for its numbers)',
        'Pick a language at the top for per-set progress (grouped by level), most-missed words ("Practice these" in one tap) and recent games',
        'Badges: 3/7/30-day streaks, 50/200/500/1000 words mastered, 1/10 sets completed and ×10/×25 combos. Badges not yet earned are grey and show how far along you are',
      ],
    },
    {
      id: 'settings', icon: 'settings', color: 'gray', title: 'Settings',
      items: [
        'Translation & app language: Thai or English',
        'Questions per round: 10, 20, 30 or all',
        'Daily goal: 10, 20, 50 or 100 answers per day (default 20)',
        'Show reading (kana and romanization), auto pronounce and sound effects (right/wrong/combo sounds)',
        'Theme: System (default), Light or Dark',
        'Export your progress to a .json backup and import it back (merged with this device, never overwriting newer answers), handy for switching devices',
        'Reset progress per language, and see the version and "What\'s new"',
      ],
    },
    {
      id: 'install', icon: 'share', color: 'teal', title: 'Add to Home Screen (iPhone / iPad)',
      items: [
        { b: '1.', text: 'Open this app in Safari' },
        { b: '2.', text: 'Tap Share (square with an up arrow): bottom bar on iPhone, top right on iPad. If hidden, tap ••• first' },
        { b: '3.', text: 'Scroll down and choose "Add to Home Screen"' },
        { b: '4.', text: 'Keep "Open as Web App" on, then tap "Add"' },
        'Launch it from the Home Screen icon: full screen, no Safari bars, works offline',
      ],
    },
    {
      id: 'voice', icon: 'speaker', color: 'orange', title: 'Pronunciation',
      items: [
        'Uses the voices on your device. If none, go to Settings › Accessibility › Spoken Content › Voices and download one',
        'No sound? Check the silent switch and the volume',
      ],
    },
    {
      id: 'keys', icon: 'keyboard', color: 'indigo', title: 'Keyboard shortcuts (iPad with keyboard)',
      items: [
        { b: '1–4', text: 'choose an answer' },
        { b: 'Enter / Space', text: 'next question or flip the card' },
        { b: '← / →', text: 'flashcards: same as swiping left (not yet) / right (got it)' },
        { b: 'Z / Backspace', text: 'flashcards: undo the last card' },
      ],
    },
    {
      id: 'about', icon: 'info', color: 'gray', title: 'About & license',
      items: [
        'All vocabulary was written for this app and released under CC0 (public domain), free for any use including commercial',
        'Nothing is copied from copyrighted or restricted word lists such as the Oxford 3000, NGSL or TOPIK/JLPT lists',
        'Progress is stored on this device only',
        'See what changed in each version in Settings › What\'s new',
      ],
    },
  ],
};
