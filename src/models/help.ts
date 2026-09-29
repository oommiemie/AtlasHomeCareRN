/**
 * What the app can do, written as the questions people actually ask.
 *
 * Kept out of the screen so the page can search it — and so that whatever
 * else comes to answer out of it later reads the same list the page shows,
 * rather than a second copy that drifts.
 *
 * Written in the second person, in the order a carer would do the thing —
 * a help page that describes a screen is a help page nobody finishes
 * reading.
 */

import { tr } from "../i18n";

/**
 * Topics are the Thai names they were written under: the help page keys
 * its icons and colours by them. `topicLabel` is what the page shows.
 */
export type Topic =
  | "งาน"
  | "เยี่ยมบ้าน"
  | "วัคซีน"
  | "ตรวจสุขภาพ"
  | "คัดกรอง"
  | "ทันตกรรม"
  | "ยาและเวชภัณฑ์"
  | "สมุดจด"
  | "ประวัติและรายงาน"
  | "บัญชีและความปลอดภัย"
  | "การใช้งานทั่วไป";

export type Answer = { topic: Topic; q: string; a: string };

const TOPIC_EN: Record<Topic, string> = {
  งาน: "Tasks",
  เยี่ยมบ้าน: "Home visits",
  วัคซีน: "Vaccination",
  ตรวจสุขภาพ: "Health checks",
  คัดกรอง: "Screening",
  ทันตกรรม: "Dental",
  ยาและเวชภัณฑ์: "Medication and supplies",
  สมุดจด: "Notebook",
  ประวัติและรายงาน: "History and reports",
  บัญชีและความปลอดภัย: "Account and security",
  การใช้งานทั่วไป: "General use",
};

/** A topic's name in the language the app speaks. */
export const topicLabel = (t: Topic): string => tr(t, TOPIC_EN[t]);

export const HELP: Answer[] = [
  /* ---------------------------------------------------------- งาน */
  {
    topic: "งาน",
    q: tr("รับภารกิจใหม่ได้อย่างไร", "How do I accept a new task?"),
    a: tr(
      'ไปที่หน้าแรก แตะการ์ดภารกิจใหม่ที่รอรับงาน อ่านรายละเอียดผู้ป่วยแล้วกด "รับงาน" ภารกิจจะย้ายไปอยู่ในแผนเยี่ยมของคุณทันที',
      'On the home page, tap the card of a new task waiting to be accepted, read the patient details, then tap "Accept." The task moves into your visit plan straight away.',
    ),
  },
  {
    topic: "งาน",
    q: tr("ปฏิเสธงานแล้วจะเกิดอะไรขึ้น", "What happens if I decline a task?"),
    a: tr(
      "ระบบจะถามเหตุผล แล้วส่งงานกลับไปให้ผู้ประสานงานจัดสรรให้คนอื่น งานจะไม่หายไปจากระบบ และเหตุผลที่คุณให้จะติดไปกับงานนั้น",
      "You'll be asked for a reason, and the task goes back to the coordinator to assign to someone else. The task isn't lost, and your reason stays attached to it.",
    ),
  },
  {
    topic: "งาน",
    q: tr(
      "สรุปงานวันนี้บนหน้าแรกนับอะไรบ้าง",
      "What does today's summary on the home page count?",
    ),
    a: tr(
      "นับทั้งงานเยี่ยมบ้านและงานกลุ่มทั้งสามบริการในวันเดียวกัน วงในโดนัทคือวัคซีน ตรวจสุขภาพ และคัดกรองพัฒนาการ ส่วนแถบซ้ายคือสัดส่วนงานเยี่ยมบ้านที่ปิดแล้ว",
      "It counts both home visits and the three group services on the same day. The inner ring of the donut shows vaccination, health checks and developmental screening; the bar on the left shows the share of home visits already closed.",
    ),
  },
  {
    topic: "งาน",
    q: tr("งานค้างคืออะไร", "What is an overdue task?"),
    a: tr(
      "คืองานที่เลยวันที่กำหนดแล้วแต่ยังไม่ได้ปิด แสดงย้อนหลังได้ 90 วัน เรียงจากที่ค้างนานที่สุด พอปิดงานเมื่อไหร่จะหลุดจากรายการทันที ต่อให้ปิดช้าไปเป็นสัปดาห์",
      "A task that is past its due date but hasn't been closed. The list goes back 90 days, oldest first. Once you close a task it drops off the list immediately, even if it's a week late.",
    ),
  },

  /* --------------------------------------------------- เยี่ยมบ้าน */
  {
    topic: "เยี่ยมบ้าน",
    q: tr("บันทึกการเยี่ยมบ้านอย่างไร", "How do I record a home visit?"),
    a: tr(
      'เปิดภารกิจจากแผนเยี่ยม กด "เริ่มเยี่ยม" แล้วบันทึกสัญญาณชีพ อาการ และสิ่งที่ทำ ระบบบันทึกร่างให้อัตโนมัติระหว่างทาง ปิดงานเมื่อออกจากบ้าน',
      'Open the task from your visit plan, tap "Start visit," then record vital signs, symptoms and what you did. A draft is saved automatically as you go. Close the task when you leave the house.',
    ),
  },
  {
    topic: "เยี่ยมบ้าน",
    q: tr(
      "ไปถึงแล้วไม่มีคนอยู่บ้าน ทำอย่างไร",
      "I arrived and nobody is home. What should I do?",
    ),
    a: tr(
      'บันทึกผลเป็น "ไม่พบผู้ป่วย" พร้อมเหตุผล งานจะยังอยู่ในแผนและถูกนับเป็นงานค้าง เพื่อให้กลับไปใหม่ได้',
      'Record the outcome as "Patient not found" with a reason. The task stays in your plan and counts as overdue, so you can go back later.',
    ),
  },
  {
    topic: "เยี่ยมบ้าน",
    q: tr(
      "ดูเส้นทางไปบ้านผู้ป่วยได้ไหม",
      "Can I see directions to the patient's house?",
    ),
    a: tr(
      "ได้ แตะแผนที่บนหน้าแรกหรือไอคอนแผนที่ในการ์ดภารกิจ จะเห็นหมุดบ้านทุกหลังที่ต้องไปวันนี้ และกดเปิดใน Google Maps ต่อได้",
      "Yes. Tap the map on the home page or the map icon on a task card. You'll see a pin for every house you need to visit today, and you can open it in Google Maps.",
    ),
  },

  /* ------------------------------------------------------- วัคซีน */
  {
    topic: "วัคซีน",
    q: tr(
      "เปิด Session ฉีดวัคซีนอย่างไร",
      "How do I open a vaccination session?",
    ),
    a: tr(
      "ไปที่ บริการ → วัคซีนโรงเรียน เลือกรอบของวันนี้ แล้วกรอกวัคซีน รุ่นการผลิต และผู้ให้บริการ จากนั้นจะได้รายชื่อทั้งห้องมาให้ติ๊ก",
      "Go to Services → School vaccination, choose today's round, then enter the vaccine, lot number and provider. You'll then get the whole class list to check off.",
    ),
  },
  {
    topic: "วัคซีน",
    q: tr(
      "ระบบเตือนว่าเข็มนี้ยังไม่ถึงกำหนด จะทำอย่างไร",
      "The app warns this dose isn't due yet. What should I do?",
    ),
    a: tr(
      "ระบบจะไม่ให้บันทึกจนกว่าจะใส่เหตุผล กดที่แถวนั้นแล้วเลือกเหตุผลหรือพิมพ์เอง เหตุผลจะถูกบันทึกไว้ในประวัติคู่กับเข็มที่ให้",
      "You can't save until you give a reason. Tap that row, then choose a reason or type your own. The reason is recorded in the history alongside the dose given.",
    ),
  },
  {
    topic: "วัคซีน",
    q: tr(
      "เด็กไม่มาหรือผู้ปกครองปฏิเสธ บันทึกอย่างไร",
      "A child is absent or the parent refuses. How do I record it?",
    ),
    a: tr(
      'แตะแถวของเด็กคนนั้นแล้วเลือก "ไม่มารับบริการ" หรือ "ปฏิเสธ" ทั้งสองอย่างต้องระบุเหตุผล เพราะเป็นการตัดสินใจเกี่ยวกับตัวบุคคล',
      "Tap that child's row and choose \"Did not attend\" or \"Refused.\" Both need a reason, because it is a decision about an individual.",
    ),
  },

  /* -------------------------------------------------- ตรวจสุขภาพ */
  {
    topic: "ตรวจสุขภาพ",
    q: tr(
      "ชั่งน้ำหนักวัดส่วนสูงบันทึกที่ไหน",
      "Where do I record weight and height?",
    ),
    a: tr(
      "บริการ → ตรวจสุขภาพนักเรียน เลือกรอบ แล้วแตะชื่อเด็กเพื่อกรอกน้ำหนัก ส่วนสูง และเส้นรอบศีรษะ (เฉพาะเด็กเล็ก) ระบบจะแปลผลตามเกณฑ์ให้เอง",
      "Services → Student health check. Choose the round, then tap a child's name to enter weight, height and head circumference (young children only). The app interprets the results against the growth criteria for you.",
    ),
  },
  {
    topic: "ตรวจสุขภาพ",
    q: tr("ผลประเมินคิดจากอะไร", "How is the assessment worked out?"),
    a: tr(
      "คิดจากน้ำหนักตามอายุ ส่วนสูงตามอายุ และน้ำหนักตามส่วนสูง เทียบกับเกณฑ์อ้างอิงการเจริญเติบโตตามอายุและเพศ กราฟใต้ผลจะแสดงเส้นของเด็กเทียบกับแถบปกติ",
      "From weight-for-age, height-for-age and weight-for-height, compared with growth reference criteria by age and sex. The chart under the result plots the child's line against the normal band.",
    ),
  },
  {
    topic: "ตรวจสุขภาพ",
    q: tr(
      "กรอกเสร็จคนหนึ่งแล้วไปคนถัดไปอย่างไร",
      "I've finished one child. How do I go to the next?",
    ),
    a: tr(
      'กด "บันทึกและไปคนถัดไป" ระบบจะพาไปเด็กคนที่ยังไม่ได้ชั่งคนถัดไปในห้องเดียวกันทันที ไม่ต้องกลับไปหน้ารายชื่อ',
      "Tap \"Save and next.\" The app takes you straight to the next child in the same class who hasn't been measured yet, without going back to the list.",
    ),
  },

  /* ------------------------------------------------------ คัดกรอง */
  {
    topic: "คัดกรอง",
    q: tr(
      "คัดกรองพัฒนาการใช้แบบไหน",
      "Which tool is used for developmental screening?",
    ),
    a: tr(
      "ใช้ DSPM ห้าด้าน ระบบเลือกช่วงอายุให้ตามวันเกิดของเด็ก แล้วแสดงข้อประเมินของช่วงนั้น แต่ละข้อมีสองปุ่มคือทำได้กับทำไม่ได้",
      "The five-domain DSPM. The app picks the age band from the child's date of birth and shows the items for that band. Each item has two buttons: Can do and Cannot do.",
    ),
  },
  {
    topic: "คัดกรอง",
    q: tr(
      "เด็กไม่ผ่านบางข้อ ต้องทำอย่างไร",
      "A child fails some items. What should I do?",
    ),
    a: tr(
      "ระบบจะสรุปเป็นสงสัยล่าช้าหรือล่าช้าให้ พร้อมแผนติดตามและวันนัดครั้งถัดไป ด้านที่ไม่ผ่านจะถูกบันทึกแยกไว้ เพื่อให้รอบหน้าเห็นว่าเป็นด้านเดิมหรือไม่",
      "The app summarizes the result as suspected delay or delay, with a follow-up plan and the next appointment date. Failed domains are recorded separately, so the next round shows whether it is the same domain.",
    ),
  },

  /* ----------------------------------------------------- ทันตกรรม */
  {
    topic: "ทันตกรรม",
    q: tr(
      "ตรวจสุขภาพช่องปากบันทึกอะไรบ้าง",
      "What does an oral health check record?",
    ),
    a: tr(
      "นับฟันน้ำนมผุ ฟันแท้ผุ และซี่ที่อุดหรือถอนแล้ว ด้วยปุ่มบวกลบ แล้วติ๊กว่าเหงือกอักเสบ มีหินปูน เคลือบฟลูออไรด์ หรือเคลือบหลุมร่องฟันหรือไม่",
      "Count decayed primary teeth, decayed permanent teeth, and teeth already filled or extracted with the plus/minus buttons, then check whether there is gingivitis, calculus, fluoride varnish or fissure sealant.",
    ),
  },
  {
    topic: "ทันตกรรม",
    q: tr(
      "ระบบตัดสินส่งต่อทันตแพทย์เมื่อไหร่",
      "When does the app decide to refer to a dentist?",
    ),
    a: tr(
      "ฟันแท้ผุแม้เพียงซี่เดียวจะส่งต่อทันที เพราะฟันแท้ไม่ขึ้นใหม่ ส่วนฟันน้ำนมผุจะส่งต่อเมื่อถึงสามซี่ ถ้ามีแค่เหงือกอักเสบหรือหินปูนจะเป็นเฝ้าระวัง",
      "A single decayed permanent tooth is referred straight away, because permanent teeth don't grow back. Decayed primary teeth are referred at three teeth. Gingivitis or calculus alone is marked for monitoring.",
    ),
  },

  /* ----------------------------------------------- ยาและเวชภัณฑ์ */
  {
    topic: "ยาและเวชภัณฑ์",
    q: tr(
      "ดูรายการที่ต้องนำส่งได้ที่ไหน",
      "Where can I see what needs to be delivered?",
    ),
    a: tr(
      "บริการ → ส่งเวชภัณฑ์และยา จะเห็นรายการของสองสัปดาห์ แยกเป็นวันนี้ ยังไม่ได้ส่ง ส่งแล้ว และทั้งหมด",
      "Services → Supplies and medication delivery. You'll see two weeks of items, split into Today, Not delivered, Delivered and All.",
    ),
  },
  {
    topic: "ยาและเวชภัณฑ์",
    q: tr("ส่งของไม่สำเร็จบันทึกอย่างไร", "How do I record a failed delivery?"),
    a: tr(
      'แตะรายการนั้นแล้วเลือก "ส่งไม่สำเร็จ" ระบบจะให้เขียนสั้น ๆ ว่าเกิดอะไรขึ้น เพราะคนที่มาตามต่อพรุ่งนี้ต้องรู้ว่าต้องทำอะไร',
      "Tap the item and choose \"Delivery failed.\" You'll be asked to write briefly what happened, because whoever follows up tomorrow needs to know what to do.",
    ),
  },

  /* -------------------------------------------------------- สมุดจด */
  {
    topic: "สมุดจด",
    q: tr("สมุดจดใช้ทำอะไร", "What is the notebook for?"),
    a: tr(
      "จดสิ่งที่ไม่มีช่องในแบบฟอร์ม เช่น สิ่งที่ครูฝากไว้หน้าโรงเรียน บ้านที่ต้องกลับไปวันพฤหัส สร้างได้หลายหน้า หน้าละเรื่อง",
      "For things that have no field in a form, such as a message a teacher left at the school gate or a house to go back to on Thursday. You can create many pages, one topic per page.",
    ),
  },
  {
    topic: "สมุดจด",
    q: tr("จัดรูปแบบข้อความได้แค่ไหน", "How much can I format text?"),
    a: tr(
      "เลือกขนาดได้สี่ระดับ ทำตัวหนา ตัวเอียง ไฮไลต์เฉพาะคำที่เลือก ทำรายการและเช็คลิสต์ที่ติ๊กได้ และแนบรูปได้",
      "Choose from four text sizes, make text bold or italic, highlight selected words, make lists and checklists you can tick, and attach photos.",
    ),
  },
  {
    topic: "สมุดจด",
    q: tr("AI ในสมุดจดช่วยอะไรได้", "How can AI help in the notebook?"),
    a: tr(
      "ลากเลือกข้อความแล้วกดรูปดาวบนหัวข้อ จะได้แก้คำผิด เรียบเรียงใหม่ หรือย่อ ถ้าไม่ได้เลือกอะไรจะทำกับทั้งหน้าและมีจัดเป็นหัวข้อให้ด้วย ส่งไปเฉพาะข้อความในหน้านั้น ไม่มีข้อมูลผู้ป่วยติดไปด้วย",
      "Select some text and tap the star icon in the header to fix typos, rewrite or shorten it. If nothing is selected it works on the whole page and can also organize it into headings. Only the text on that page is sent, with no patient data attached.",
    ),
  },
  {
    topic: "สมุดจด",
    q: tr("พูดแล้วให้พิมพ์ให้ได้ไหม", "Can I dictate instead of typing?"),
    a: tr(
      "ได้ กดรูปไมโครโฟนบนหัวข้อแล้วเลือกพูดแล้วพิมพ์ให้ ระบบถอดเสียงบนเครื่องนี้เอง เสียงไม่ถูกส่งออกไปไหน และเลือกไฟล์เสียงที่มีอยู่มาถอดเป็นข้อความก็ได้",
      "Yes. Tap the microphone icon in the header and choose dictation. Speech is transcribed on this device and the audio isn't sent anywhere. You can also pick an existing audio file to transcribe.",
    ),
  },
  {
    topic: "สมุดจด",
    q: tr(
      "ถ่ายเอกสารแล้วแปลงเป็นข้อความได้ไหม",
      "Can I photograph a document and turn it into text?",
    ),
    a: tr(
      "ได้ กดปุ่มรูปภาพบนแถบล่างแล้วเลือกถ่ายเอกสารเป็นข้อความ หรือเลือกภาพที่มีอยู่ ข้อความที่ได้จะลงเป็นบรรทัดที่แก้ต่อได้ทันที",
      "Yes. Tap the image button on the bottom bar and choose scanning a document to text, or pick an existing photo. The text comes in as lines you can edit straight away.",
    ),
  },

  /* --------------------------------------------- ประวัติและรายงาน */
  {
    topic: "ประวัติและรายงาน",
    q: tr(
      "ประวัติงานกลุ่มดูที่ไหน",
      "Where can I see the history of group services?",
    ),
    a: tr(
      "ในหน้าของแต่ละบริการ กดปุ่มประวัติมุมขวาบน จะเห็นเฉพาะรอบที่ปิดงานแล้ว แยกตามบริการ ไม่ปนกัน",
      "On each service's page, tap the history button at the top right. You'll see only rounds that have been closed, separated by service.",
    ),
  },
  {
    topic: "ประวัติและรายงาน",
    q: tr(
      "ทำไมบางรอบไม่อยู่ในประวัติ",
      "Why are some rounds missing from the history?",
    ),
    a: tr(
      "ประวัติเก็บเฉพาะรอบที่ปิดงานแล้ว รอบที่บันทึกค้างไว้จะยังอยู่ในหน้าแผนงานเป็นงานค้างจนกว่าจะปิด",
      "History keeps only closed rounds. Rounds saved but not closed stay on the plan page as overdue work until they are closed.",
    ),
  },

  /* ------------------------------------------ บัญชีและความปลอดภัย */
  {
    topic: "บัญชีและความปลอดภัย",
    q: tr("ข้อมูลผู้ป่วยปลอดภัยแค่ไหน", "How safe is patient data?"),
    a: tr(
      "ข้อมูลถูกเข้ารหัสระหว่างรับส่ง และเข้าถึงได้เฉพาะเจ้าหน้าที่ที่ได้รับมอบหมายงานนั้น อ่านเพิ่มเติมได้ที่นโยบายความเป็นส่วนตัวใน ฉัน → ข้อมูลแอพ",
      "Data is encrypted in transit and can only be accessed by staff assigned to that task. Read more in the privacy policy under Me → App info.",
    ),
  },
  {
    topic: "บัญชีและความปลอดภัย",
    q: tr(
      "เปลี่ยนสถานพยาบาลที่เข้าใช้งานอย่างไร",
      "How do I change the facility I'm signed in under?",
    ),
    a: tr(
      "เลือกตอนเข้าสู่ระบบ และคงอยู่ตลอดการใช้งานครั้งนั้น เพราะทุกงานที่บันทึกจะถูกยื่นภายใต้หน่วยนั้น ถ้าต้องการเปลี่ยนให้ออกจากระบบแล้วเข้าใหม่",
      "You choose it at sign-in and it stays for that whole session, because every record is filed under that unit. To change it, sign out and sign in again.",
    ),
  },
  {
    topic: "บัญชีและความปลอดภัย",
    q: tr(
      "สิทธิใน Authen Code ต่างจากสถานพยาบาลอย่างไร",
      "How is the Authen Code right different from the facility?",
    ),
    a: tr(
      "สถานพยาบาลคือที่ที่งานถูกบันทึกไว้ ส่วน Authen Code คือหน่วยที่บริการนั้นถูกเคลม เปลี่ยนได้ที่ ฉัน → สิทธิใน Authen Code และมีปุ่มบันทึกก่อนมีผล",
      "The facility is where the work is recorded; the Authen Code is the unit the service is claimed under. Change it under Me → Authen Code right, and tap Save for it to take effect.",
    ),
  },
  {
    topic: "บัญชีและความปลอดภัย",
    q: tr("ตั้งรหัส PIN หรือสแกนใบหน้า/ลายนิ้วมือได้ไหม", "Can I set a PIN or use Face ID / fingerprint?"),
    a: tr(
      "ได้ ที่ ฉัน → ความปลอดภัย ตั้งรหัส PIN หกหลัก และเปิดปลดล็อกด้วย Face ID, Touch ID หรือลายนิ้วมือได้ ตามที่เครื่องรองรับ",
      "Yes. Under Me → Security you can set a six-digit PIN and turn on Face ID, Touch ID or fingerprint unlock — whichever your device supports.",
    ),
  },

  /* ----------------------------------------- การใช้งานทั่วไป */
  {
    topic: "การใช้งานทั่วไป",
    q: tr(
      "ไม่มีสัญญาณอินเทอร์เน็ตจะบันทึกได้ไหม",
      "Can I record without an internet connection?",
    ),
    a: tr(
      "บันทึกได้ ข้อมูลเก็บไว้ในเครื่องก่อน และซิงก์ให้เมื่อกลับมามีสัญญาณ รอบที่ยังไม่ได้ซิงก์จะมีป้ายบอกไว้",
      "Yes. Data is kept on the device first and synced when you're back online. Rounds that haven't synced yet are labeled.",
    ),
  },
  {
    topic: "การใช้งานทั่วไป",
    q: tr(
      "เปลี่ยนขนาดตัวอักษรหรือโหมดมืดได้ไหม",
      "Can I change the text size or use dark mode?",
    ),
    a: tr(
      "ได้ที่ ฉัน → การแสดงผล เลือกธีมสว่าง มืด หรือตามระบบ ปรับขนาดตัวอักษรได้ห้าระดับ และปิดการเคลื่อนไหวได้",
      "Yes, under Me → Display. Choose a light, dark or system theme, pick from five text sizes, and turn off motion.",
    ),
  },
  {
    topic: "การใช้งานทั่วไป",
    q: tr(
      "จัดเมนูลัดหน้าแรกเองได้ไหม",
      "Can I customize the home page shortcuts?",
    ),
    a: tr(
      'ได้ กดปุ่มแก้ไขท้ายแถวเมนูลัด เพิ่ม ลบ และลากจัดลำดับได้ กด "คืนค่าเริ่มต้น" เพื่อกลับไปชุดเดิม',
      'Yes. Tap the edit button at the end of the shortcuts row to add, remove and drag to reorder. Tap "Reset to default" to go back to the original set.',
    ),
  },
  {
    topic: "การใช้งานทั่วไป",
    q: tr("ค้นหาทั้งแอปได้ที่ไหน", "Where can I search the whole app?"),
    a: tr(
      "ที่หน้าบริการ กดแว่นขยายมุมขวาบน ค้นได้ทั้งชื่อผู้ป่วย บ้าน บริการ และหน้าตั้งค่า",
      "On the Services page, tap the magnifying glass at the top right. You can search patient names, houses, services and settings pages.",
    ),
  },
];

/** Every topic that has at least one answer, in the order they are written. */
export const TOPICS: Topic[] = [...new Set(HELP.map((h) => h.topic))];

/** What matches a query, by question, answer or topic. */
export function searchHelp(query: string): Answer[] {
  const q = query.trim().toLowerCase();
  if (q === "") return HELP;
  return HELP.filter(
    (h) =>
      h.q.toLowerCase().includes(q) ||
      h.a.toLowerCase().includes(q) ||
      h.topic.toLowerCase().includes(q) ||
      topicLabel(h.topic).toLowerCase().includes(q),
  );
}
