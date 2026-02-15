import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ============================================================
  // 1. Conference + Submission Window
  // ============================================================
  const conference = await prisma.conference.create({
    data: {
      name: "2028 General Conference",
      year: 2028,
      isActive: true,
    },
  });
  console.log("✅ Conference created:", conference.name);

  await prisma.submissionWindow.create({
    data: {
      conferenceId: conference.id,
      name: "General Petition Submission",
      opensAt: new Date("2027-04-01T00:00:00Z"),
      closesAt: new Date("2027-09-15T23:59:59Z"),
    },
  });
  console.log("✅ Submission window created");

  // ============================================================
  // 2. Books
  // ============================================================
  const discipline = await prisma.book.create({
    data: { title: "The Book of Discipline", editionYear: 2024 },
  });
  const resolutionsBook = await prisma.book.create({
    data: { title: "The Book of Resolutions", editionYear: 2024 },
  });
  console.log("✅ Books created: Discipline + Resolutions");

  // ============================================================
  // 3. Discipline Sections + Paragraphs
  // ============================================================

  // Part I: The Constitution (¶¶ 1–61)
  const partI = await prisma.section.create({
    data: {
      bookId: discipline.id,
      title: "Part I: The Constitution",
      level: 0,
      sortOrder: 1,
    },
  });

  const constitutionParagraphs = [
    { number: 1, title: "Preamble", tags: ["constitution"] },
    { number: 2, title: "Division One – General", tags: ["constitution"] },
    { number: 3, title: "Article I – Declaration of Union", tags: ["constitution"] },
    { number: 4, title: "Article II – Name", tags: ["constitution"] },
    { number: 5, title: "Article III – Articles of Religion", tags: ["constitution", "doctrine"] },
    { number: 6, title: "Article IV – Inclusiveness", tags: ["constitution"] },
    { number: 7, title: "Article V – Racial Justice", tags: ["constitution"] },
    { number: 8, title: "Article VI – Ecumenical Relations", tags: ["constitution"] },
    { number: 9, title: "Division Two – Organization", tags: ["constitution", "organization"] },
    { number: 10, title: "General Conference", tags: ["constitution", "general-conference"] },
    { number: 11, title: "General Conference Powers", tags: ["constitution", "general-conference"] },
    { number: 12, title: "General Conference Restrictions", tags: ["constitution", "general-conference"] },
    { number: 13, title: "General Conference Composition", tags: ["constitution", "general-conference"] },
    { number: 14, title: "Judicial Council", tags: ["constitution", "judicial"] },
    { number: 15, title: "Jurisdictional Conferences", tags: ["constitution", "jurisdictional"] },
    { number: 16, title: "Jurisdictional Powers", tags: ["constitution", "jurisdictional"] },
    { number: 20, title: "Central Conferences", tags: ["constitution", "central-conference"] },
    { number: 21, title: "Central Conference Powers", tags: ["constitution", "central-conference"] },
    { number: 27, title: "Annual Conferences", tags: ["constitution", "annual-conference"] },
    { number: 28, title: "Annual Conference Composition", tags: ["constitution", "annual-conference"] },
    { number: 32, title: "District Conferences", tags: ["constitution", "district"] },
    { number: 33, title: "Charge Conferences", tags: ["constitution", "local-church"] },
    { number: 34, title: "Church Conferences", tags: ["constitution", "local-church"] },
    { number: 40, title: "Division Three – Episcopal Supervision", tags: ["constitution", "episcopacy"] },
    { number: 41, title: "Election of Bishops", tags: ["constitution", "episcopacy"] },
    { number: 42, title: "Bishop Roles", tags: ["constitution", "episcopacy"] },
    { number: 50, title: "Division Four – The Judiciary", tags: ["constitution", "judicial"] },
    { number: 51, title: "Judicial Council Composition", tags: ["constitution", "judicial"] },
    { number: 52, title: "Judicial Council Jurisdiction", tags: ["constitution", "judicial"] },
    { number: 57, title: "Division Five – Amendments", tags: ["constitution", "amendments"] },
    { number: 58, title: "Amendment by General Conference", tags: ["constitution", "amendments"] },
    { number: 59, title: "Amendment by Annual Conference", tags: ["constitution", "amendments"] },
    { number: 60, title: "Constitutional Amendments Process", tags: ["constitution", "amendments"] },
    { number: 61, title: "Restrictive Rules", tags: ["constitution", "amendments"] },
  ];

  for (const p of constitutionParagraphs) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: partI.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Part I: ${constitutionParagraphs.length} paragraphs`);

  // Part II: General Book of Discipline
  const partII = await prisma.section.create({
    data: {
      bookId: discipline.id,
      title: "Part II: General Book of Discipline",
      level: 0,
      sortOrder: 2,
    },
  });
  await prisma.paragraph.create({
    data: {
      bookId: discipline.id,
      sectionId: partII.id,
      number: 101,
      title: "The General Book of Discipline",
      currentText: "[Text of ¶101 — The General Book of Discipline]",
      categoryTags: ["general"],
    },
  });
  console.log("✅ Part II: 1 paragraph");

  // Part III: Doctrinal Standards and Our Theological Task
  const partIII = await prisma.section.create({
    data: {
      bookId: discipline.id,
      title: "Part III: Doctrinal Standards and Our Theological Task",
      level: 0,
      sortOrder: 3,
    },
  });

  const doctrinalParagraphs = [
    { number: 102, title: "Our Doctrinal Heritage", tags: ["doctrine"] },
    { number: 103, title: "Our Doctrinal Standards", tags: ["doctrine"] },
    { number: 104, title: "Our Theological Task", tags: ["doctrine"] },
    { number: 105, title: "Doctrinal Standards and General Rules", tags: ["doctrine"] },
  ];
  for (const p of doctrinalParagraphs) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: partIII.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Part III: ${doctrinalParagraphs.length} paragraphs`);

  // Part IV: The Ministry of All Christians
  const partIV = await prisma.section.create({
    data: {
      bookId: discipline.id,
      title: "Part IV: The Ministry of All Christians",
      level: 0,
      sortOrder: 4,
    },
  });

  const ministryParagraphs = [
    { number: 120, title: "The Ministry of All Christians", tags: ["ministry", "local-church"] },
    { number: 121, title: "The Heart of Christian Ministry", tags: ["ministry"] },
    { number: 122, title: "The Ministry of the Laity", tags: ["ministry", "laity"] },
    { number: 123, title: "Servant Ministry and Servant Leadership", tags: ["ministry"] },
    { number: 124, title: "The Ordained Ministry", tags: ["ministry", "ordained"] },
    { number: 125, title: "The Ministry of Deacons", tags: ["ministry", "deacon"] },
    { number: 126, title: "The Ministry of Elders", tags: ["ministry", "elder"] },
    { number: 127, title: "Appointments", tags: ["ministry", "appointments"] },
    { number: 130, title: "Candidacy for Ordained Ministry", tags: ["ministry", "candidacy"] },
    { number: 135, title: "Provisional Membership", tags: ["ministry", "provisional"] },
    { number: 140, title: "Full Conference Membership", tags: ["ministry", "full-member"] },
    { number: 143, title: "Changes of Conference Relationship", tags: ["ministry", "conference-relations"] },
  ];
  for (const p of ministryParagraphs) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: partIV.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Part IV: ${ministryParagraphs.length} paragraphs`);

  // Part V: Social Principles
  const partV = await prisma.section.create({
    data: {
      bookId: discipline.id,
      title: "Part V: Social Principles",
      level: 0,
      sortOrder: 5,
    },
  });

  const socialPrinciplesParagraphs = [
    { number: 160, title: "Preface to the Social Principles", tags: ["social-principles"] },
    { number: 161, title: "The Natural World", tags: ["social-principles", "natural-world"] },
    { number: 162, title: "The Nurturing Community", tags: ["social-principles", "nurturing-community"] },
    { number: 163, title: "The Social Community", tags: ["social-principles", "social-community"] },
    { number: 164, title: "The Economic Community", tags: ["social-principles", "economic-community"] },
    { number: 165, title: "The Political Community", tags: ["social-principles", "political-community"] },
    { number: 166, title: "The World Community", tags: ["social-principles", "world-community"] },
  ];
  for (const p of socialPrinciplesParagraphs) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: partV.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Part V: ${socialPrinciplesParagraphs.length} paragraphs`);

  // Part VI: Organization and Administration
  const partVI = await prisma.section.create({
    data: {
      bookId: discipline.id,
      title: "Part VI: Organization and Administration",
      level: 0,
      sortOrder: 6,
    },
  });

  // Chapter 1: The Local Church (¶¶ 201–259)
  const ch1 = await prisma.section.create({
    data: {
      bookId: discipline.id,
      parentId: partVI.id,
      title: "Chapter 1: The Local Church",
      level: 1,
      sortOrder: 1,
    },
  });
  const localChurchParas = [
    { number: 201, title: "Definition of a Local Church", tags: ["local-church", "organization"] },
    { number: 202, title: "Relation to the Whole Church", tags: ["local-church", "organization"] },
    { number: 203, title: "Ecumenical Commitment", tags: ["local-church"] },
    { number: 205, title: "Membership", tags: ["local-church", "membership"] },
    { number: 206, title: "Baptism", tags: ["local-church", "sacraments"] },
    { number: 210, title: "Organization", tags: ["local-church", "organization"] },
    { number: 215, title: "Church Council", tags: ["local-church", "governance"] },
    { number: 220, title: "Board of Trustees", tags: ["local-church", "property"] },
    { number: 225, title: "Staff-Parish Relations Committee", tags: ["local-church", "sprc"] },
    { number: 230, title: "Committee on Finance", tags: ["local-church", "finance"] },
    { number: 235, title: "Committee on Nominations", tags: ["local-church", "nominations"] },
    { number: 240, title: "Lay Leader", tags: ["local-church", "laity"] },
    { number: 245, title: "Lay Member to Annual Conference", tags: ["local-church", "annual-conference"] },
    { number: 246, title: "United Methodist Women", tags: ["local-church", "umw"] },
    { number: 247, title: "United Methodist Men", tags: ["local-church", "umm"] },
    { number: 250, title: "Church Property", tags: ["local-church", "property"] },
    { number: 252, title: "Trust Clause", tags: ["local-church", "property", "trust"] },
    { number: 259, title: "Closure or Discontinuance", tags: ["local-church", "closure"] },
  ];
  for (const p of localChurchParas) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: ch1.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Chapter 1 (Local Church): ${localChurchParas.length} paragraphs`);

  // Chapter 2: The District (¶¶ 301–370)
  const ch2 = await prisma.section.create({
    data: {
      bookId: discipline.id,
      parentId: partVI.id,
      title: "Chapter 2: The District",
      level: 1,
      sortOrder: 2,
    },
  });
  const districtParas = [
    { number: 301, title: "Purpose of the District", tags: ["district", "organization"] },
    { number: 305, title: "District Superintendent", tags: ["district", "superintendent"] },
    { number: 310, title: "District Conference", tags: ["district", "conference"] },
    { number: 320, title: "District Board of Church Location", tags: ["district", "property"] },
    { number: 330, title: "District Committee on Ordained Ministry", tags: ["district", "ministry"] },
    { number: 340, title: "District Board of Missions", tags: ["district", "missions"] },
    { number: 350, title: "District Committees", tags: ["district", "committees"] },
    { number: 360, title: "District Union", tags: ["district", "union"] },
    { number: 370, title: "District Property", tags: ["district", "property"] },
  ];
  for (const p of districtParas) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: ch2.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Chapter 2 (District): ${districtParas.length} paragraphs`);

  // Chapter 3: The Annual Conference (¶¶ 401–470)
  const ch3 = await prisma.section.create({
    data: {
      bookId: discipline.id,
      parentId: partVI.id,
      title: "Chapter 3: The Annual Conference",
      level: 1,
      sortOrder: 3,
    },
  });
  const annualConfParas = [
    { number: 401, title: "Definition of Annual Conference", tags: ["annual-conference", "organization"] },
    { number: 402, title: "Membership of Annual Conference", tags: ["annual-conference", "membership"] },
    { number: 403, title: "Sessions of Annual Conference", tags: ["annual-conference"] },
    { number: 410, title: "Conference Boards", tags: ["annual-conference", "boards"] },
    { number: 420, title: "Board of Ordained Ministry", tags: ["annual-conference", "ministry"] },
    { number: 425, title: "Board of Pensions", tags: ["annual-conference", "pensions"] },
    { number: 430, title: "Conference Board of Trustees", tags: ["annual-conference", "property"] },
    { number: 440, title: "Conference Commissions", tags: ["annual-conference", "commissions"] },
    { number: 450, title: "Conference Committees", tags: ["annual-conference", "committees"] },
    { number: 460, title: "Annual Conference Property", tags: ["annual-conference", "property"] },
    { number: 470, title: "Conference Finances", tags: ["annual-conference", "finance"] },
  ];
  for (const p of annualConfParas) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: ch3.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Chapter 3 (Annual Conference): ${annualConfParas.length} paragraphs`);

  // Chapter 4: The Jurisdictional Conference (¶¶ 501–537)
  const ch4 = await prisma.section.create({
    data: {
      bookId: discipline.id,
      parentId: partVI.id,
      title: "Chapter 4: The Jurisdictional Conference",
      level: 1,
      sortOrder: 4,
    },
  });
  const jurisdictionalParas = [
    { number: 501, title: "Jurisdictional Conference", tags: ["jurisdictional", "organization"] },
    { number: 510, title: "Jurisdictional Conference Powers", tags: ["jurisdictional", "powers"] },
    { number: 520, title: "Jurisdictional Boards", tags: ["jurisdictional", "boards"] },
    { number: 530, title: "Committee on Episcopacy", tags: ["jurisdictional", "episcopacy"] },
    { number: 537, title: "Jurisdictional Property", tags: ["jurisdictional", "property"] },
  ];
  for (const p of jurisdictionalParas) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: ch4.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Chapter 4 (Jurisdictional): ${jurisdictionalParas.length} paragraphs`);

  // Chapter 5: Central Conferences (¶¶ 540–567)
  const ch5 = await prisma.section.create({
    data: {
      bookId: discipline.id,
      parentId: partVI.id,
      title: "Chapter 5: Central Conferences",
      level: 1,
      sortOrder: 5,
    },
  });
  const centralConfParas = [
    { number: 540, title: "Central Conferences", tags: ["central-conference", "organization"] },
    { number: 543, title: "Central Conference Powers", tags: ["central-conference", "powers"] },
    { number: 550, title: "Central Conference Organization", tags: ["central-conference", "organization"] },
    { number: 560, title: "Provisional Central Conferences", tags: ["central-conference", "provisional"] },
    { number: 567, title: "Central Conference Property", tags: ["central-conference", "property"] },
  ];
  for (const p of centralConfParas) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: ch5.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Chapter 5 (Central Conferences): ${centralConfParas.length} paragraphs`);

  // Chapter 6: General Conference (¶¶ 601–610)
  const ch6 = await prisma.section.create({
    data: {
      bookId: discipline.id,
      parentId: partVI.id,
      title: "Chapter 6: General Conference",
      level: 1,
      sortOrder: 6,
    },
  });
  const gcParas = [
    { number: 601, title: "Composition of General Conference", tags: ["general-conference", "organization"] },
    { number: 602, title: "Delegates to General Conference", tags: ["general-conference", "delegates"] },
    { number: 603, title: "Powers and Duties", tags: ["general-conference", "powers"] },
    { number: 604, title: "Business of General Conference", tags: ["general-conference", "business"] },
    { number: 605, title: "Petitions to General Conference", tags: ["general-conference", "petitions"] },
    { number: 610, title: "Rules of Order", tags: ["general-conference", "rules"] },
  ];
  for (const p of gcParas) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: ch6.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Chapter 6 (General Conference): ${gcParas.length} paragraphs`);

  // Chapter 7: General Agencies (¶¶ 701–900+)
  const ch7 = await prisma.section.create({
    data: {
      bookId: discipline.id,
      parentId: partVI.id,
      title: "Chapter 7: Councils, Boards, Commissions, and Committees",
      level: 1,
      sortOrder: 7,
    },
  });
  const agencyParas = [
    { number: 701, title: "General Provisions", tags: ["general-agency", "organization"] },
    { number: 702, title: "Council of Bishops", tags: ["general-agency", "episcopacy"] },
    { number: 703, title: "Connectional Table", tags: ["general-agency", "connectional"] },
    { number: 705, title: "General Council on Finance and Administration (GCFA)", tags: ["general-agency", "finance"] },
    { number: 710, title: "General Board of Church and Society (GBCS)", tags: ["general-agency", "church-society"] },
    { number: 715, title: "General Board of Discipleship (GBOD)", tags: ["general-agency", "discipleship"] },
    { number: 720, title: "General Board of Global Ministries (GBGM)", tags: ["general-agency", "global-ministries"] },
    { number: 725, title: "General Board of Higher Education and Ministry (GBHEM)", tags: ["general-agency", "higher-ed"] },
    { number: 730, title: "United Methodist Communications (UMCom)", tags: ["general-agency", "communications"] },
    { number: 735, title: "United Methodist Publishing House (UMPH)", tags: ["general-agency", "publishing"] },
    { number: 740, title: "General Commission on Religion and Race (GCORR)", tags: ["general-agency", "race-relations"] },
    { number: 745, title: "General Commission on the Status and Role of Women (GCSRW)", tags: ["general-agency", "women"] },
    { number: 750, title: "General Commission on Archives and History (GCAH)", tags: ["general-agency", "archives"] },
    { number: 806, title: "Judicial Council", tags: ["judicial-administration", "judicial"] },
    { number: 807, title: "Judicial Council Appeals", tags: ["judicial-administration", "judicial"] },
    { number: 900, title: "Church Trials", tags: ["judicial-administration", "trials"] },
    { number: 2501, title: "Property", tags: ["property", "legal"] },
    { number: 2502, title: "Church Building Plans", tags: ["property", "building"] },
    { number: 2503, title: "Trust Clause", tags: ["property", "trust"] },
    { number: 2701, title: "Complaints", tags: ["judicial-administration", "complaints"] },
    { number: 2702, title: "Administrative Process", tags: ["judicial-administration", "admin-process"] },
    { number: 2703, title: "Fair Process", tags: ["judicial-administration", "fair-process"] },
  ];
  for (const p of agencyParas) {
    await prisma.paragraph.create({
      data: {
        bookId: discipline.id,
        sectionId: ch7.id,
        number: p.number,
        title: p.title,
        currentText: `[Text of ¶${p.number} — ${p.title}]`,
        categoryTags: p.tags,
      },
    });
  }
  console.log(`✅ Chapter 7 (General Agencies + Judicial + Property): ${agencyParas.length} paragraphs`);

  // ============================================================
  // 4. Resolution Sections + Resolutions
  // ============================================================

  // Section: ¶160 Community of All Creation
  const resSec1 = await prisma.section.create({
    data: {
      bookId: resolutionsBook.id,
      title: "¶160 Community of All Creation",
      level: 0,
      sortOrder: 1,
    },
  });
  const sec1Resolutions = [
    { number: 1101, title: "God's Creation and the Church", sp: "¶161", topic: "environment" },
    { number: 1102, title: "Environmental Justice for a Sustainable Future", sp: "¶161", topic: "environment" },
    { number: 1103, title: "Environmental Stewardship", sp: "¶161", topic: "environment" },
    { number: 1104, title: "Energy Policy Statement", sp: "¶161", topic: "energy" },
    { number: 1105, title: "Water Stewardship", sp: "¶161", topic: "environment" },
    { number: 1110, title: "Climate Stewardship", sp: "¶161", topic: "climate" },
    { number: 1200, title: "God's Renewed Creation: A Call to Hope and Action", sp: "¶161", topic: "environment" },
    { number: 1201, title: "Caring for Creation", sp: "¶161", topic: "environment" },
    { number: 1217, title: "United Methodist Principles on Food", sp: "¶161", topic: "food" },
  ];
  for (const r of sec1Resolutions) {
    await prisma.resolution.create({
      data: {
        bookId: resolutionsBook.id,
        sectionId: resSec1.id,
        resolutionNumber: r.number,
        title: r.title,
        currentText: `[Text of Resolution ${r.number} — ${r.title}]`,
        socialPrinciplePara: r.sp,
        topicGroup: r.topic,
      },
    });
  }
  console.log(`✅ Resolution Section 1 (Creation): ${sec1Resolutions.length} resolutions`);

  // Section: ¶161 Economic Community
  const resSec2 = await prisma.section.create({
    data: {
      bookId: resolutionsBook.id,
      title: "¶161 Economic Community",
      level: 0,
      sortOrder: 2,
    },
  });
  const sec2Resolutions = [
    { number: 2101, title: "Economic Justice", sp: "¶164", topic: "economics" },
    { number: 2102, title: "Living Wage Model", sp: "¶164", topic: "economics" },
    { number: 2103, title: "Workers' Rights", sp: "¶164", topic: "labor" },
    { number: 2104, title: "Global Economic Justice", sp: "¶164", topic: "economics" },
    { number: 2110, title: "Church Investments", sp: "¶164", topic: "finance" },
    { number: 2200, title: "Global Debt Crisis", sp: "¶164", topic: "economics" },
    { number: 2201, title: "Fair Trade", sp: "¶164", topic: "trade" },
    { number: 2231, title: "Rural Communities in Crisis", sp: "¶164", topic: "rural" },
  ];
  for (const r of sec2Resolutions) {
    await prisma.resolution.create({
      data: {
        bookId: resolutionsBook.id,
        sectionId: resSec2.id,
        resolutionNumber: r.number,
        title: r.title,
        currentText: `[Text of Resolution ${r.number} — ${r.title}]`,
        socialPrinciplePara: r.sp,
        topicGroup: r.topic,
      },
    });
  }
  console.log(`✅ Resolution Section 2 (Economic): ${sec2Resolutions.length} resolutions`);

  // Section: ¶162 Social Community
  const resSec3 = await prisma.section.create({
    data: {
      bookId: resolutionsBook.id,
      title: "¶162 Social Community",
      level: 0,
      sortOrder: 3,
    },
  });
  const sec3Resolutions = [
    { number: 3101, title: "Rights of Children", sp: "¶162", topic: "children" },
    { number: 3102, title: "Eradication of Sexual Harassment", sp: "¶162", topic: "harassment" },
    { number: 3103, title: "Gender Justice", sp: "¶162", topic: "gender" },
    { number: 3104, title: "Aging in the United States", sp: "¶162", topic: "aging" },
    { number: 3200, title: "Health Care for All", sp: "¶162", topic: "health" },
    { number: 3201, title: "Mental Health", sp: "¶162", topic: "health" },
    { number: 3300, title: "Education", sp: "¶162", topic: "education" },
    { number: 3301, title: "Public Education and the Church", sp: "¶162", topic: "education" },
    { number: 3350, title: "Immigration", sp: "¶162", topic: "immigration" },
    { number: 3357, title: "Welcoming the Stranger", sp: "¶162", topic: "immigration" },
  ];
  for (const r of sec3Resolutions) {
    await prisma.resolution.create({
      data: {
        bookId: resolutionsBook.id,
        sectionId: resSec3.id,
        resolutionNumber: r.number,
        title: r.title,
        currentText: `[Text of Resolution ${r.number} — ${r.title}]`,
        socialPrinciplePara: r.sp,
        topicGroup: r.topic,
      },
    });
  }
  console.log(`✅ Resolution Section 3 (Social): ${sec3Resolutions.length} resolutions`);

  // Section: ¶163 Political Community
  const resSec4 = await prisma.section.create({
    data: {
      bookId: resolutionsBook.id,
      title: "¶163 Political Community",
      level: 0,
      sortOrder: 4,
    },
  });
  const sec4Resolutions = [
    { number: 4101, title: "Church-State Relations", sp: "¶165", topic: "church-state" },
    { number: 4102, title: "Religious Liberty", sp: "¶165", topic: "religious-liberty" },
    { number: 4103, title: "Political Responsibility", sp: "¶165", topic: "politics" },
    { number: 4200, title: "Criminal Justice", sp: "¶165", topic: "justice" },
    { number: 4201, title: "Restorative Justice", sp: "¶165", topic: "justice" },
    { number: 4301, title: "Peace with Justice", sp: "¶166", topic: "peace" },
  ];
  for (const r of sec4Resolutions) {
    await prisma.resolution.create({
      data: {
        bookId: resolutionsBook.id,
        sectionId: resSec4.id,
        resolutionNumber: r.number,
        title: r.title,
        currentText: `[Text of Resolution ${r.number} — ${r.title}]`,
        socialPrinciplePara: r.sp,
        topicGroup: r.topic,
      },
    });
  }
  console.log(`✅ Resolution Section 4 (Political): ${sec4Resolutions.length} resolutions`);

  // Section: Other Resolutions
  const resSec5 = await prisma.section.create({
    data: {
      bookId: resolutionsBook.id,
      title: "Other Resolutions",
      level: 0,
      sortOrder: 5,
    },
  });
  const sec5Resolutions = [
    { number: 5101, title: "Mission and Evangelism", sp: null, topic: "mission" },
    { number: 5102, title: "Young People's Ministries", sp: null, topic: "youth" },
    { number: 5200, title: "Worship", sp: null, topic: "worship" },
    { number: 5201, title: "Sacraments", sp: null, topic: "worship" },
    { number: 5300, title: "Administrative Order", sp: null, topic: "admin" },
    { number: 5304, title: "Church Structure and Governance", sp: null, topic: "governance" },
  ];
  for (const r of sec5Resolutions) {
    await prisma.resolution.create({
      data: {
        bookId: resolutionsBook.id,
        sectionId: resSec5.id,
        resolutionNumber: r.number,
        title: r.title,
        currentText: `[Text of Resolution ${r.number} — ${r.title}]`,
        socialPrinciplePara: r.sp,
        topicGroup: r.topic,
      },
    });
  }
  console.log(`✅ Resolution Section 5 (Other): ${sec5Resolutions.length} resolutions`);

  // ============================================================
  // 5. Legislative Committees (15 committees with routing rules)
  // ============================================================
  const committees = [
    {
      name: "Church and Society 1",
      abbreviation: "CS1",
      description: "Social Principles ¶160–163; Resolutions 1100–3399",
      routingRules: {
        paragraphRanges: [{ from: 160, to: 163 }],
        resolutionRanges: [{ from: 1100, to: 3399 }],
        tags: ["social-principles", "natural-world", "nurturing-community", "social-community"],
      },
    },
    {
      name: "Church and Society 2",
      abbreviation: "CS2",
      description: "Social Principles ¶164–166; Resolutions 2100–2299, 4100–4399",
      routingRules: {
        paragraphRanges: [{ from: 164, to: 166 }],
        resolutionRanges: [{ from: 2100, to: 2299 }, { from: 4100, to: 4399 }],
        tags: ["economic-community", "political-community", "world-community"],
      },
    },
    {
      name: "Church and Society 3",
      abbreviation: "CS3",
      description: "Remaining Church and Society resolutions",
      routingRules: {
        paragraphRanges: [],
        resolutionRanges: [{ from: 3400, to: 3999 }, { from: 4400, to: 4999 }],
        tags: [],
      },
    },
    {
      name: "Conferences",
      abbreviation: "CO",
      description: "Annual, jurisdictional, central conference paragraphs ¶¶ 401–567",
      routingRules: {
        paragraphRanges: [{ from: 401, to: 567 }],
        resolutionRanges: [],
        tags: ["annual-conference", "jurisdictional", "central-conference"],
      },
    },
    {
      name: "Discipleship",
      abbreviation: "DI",
      description: "Doctrine, worship, sacraments ¶¶ 102–105; Resolutions 5200–5201",
      routingRules: {
        paragraphRanges: [{ from: 102, to: 105 }],
        resolutionRanges: [{ from: 5200, to: 5299 }],
        tags: ["doctrine", "worship"],
      },
    },
    {
      name: "Faith and Order",
      abbreviation: "FA",
      description: "Constitution, doctrinal standards ¶¶ 1–61, 101",
      routingRules: {
        paragraphRanges: [{ from: 1, to: 61 }, { from: 101, to: 101 }],
        resolutionRanges: [],
        tags: ["constitution", "amendments"],
      },
    },
    {
      name: "Financial Administration",
      abbreviation: "FN",
      description: "Finance-related paragraphs ¶¶ 705, 230, 470",
      routingRules: {
        paragraphRanges: [{ from: 705, to: 705 }, { from: 230, to: 230 }, { from: 470, to: 470 }],
        resolutionRanges: [{ from: 2110, to: 2110 }],
        tags: ["finance"],
      },
    },
    {
      name: "General Administration",
      abbreviation: "GA",
      description: "General agencies, connectional table ¶¶ 701–703",
      routingRules: {
        paragraphRanges: [{ from: 701, to: 703 }],
        resolutionRanges: [{ from: 5300, to: 5399 }],
        tags: ["general-agency", "connectional"],
      },
    },
    {
      name: "Global Ministries",
      abbreviation: "GM",
      description: "Global ministries, missions ¶720",
      routingRules: {
        paragraphRanges: [{ from: 720, to: 720 }],
        resolutionRanges: [{ from: 5101, to: 5102 }],
        tags: ["global-ministries", "mission"],
      },
    },
    {
      name: "Higher Education and Superintendency",
      abbreviation: "HS",
      description: "Higher ed, ministry formation ¶¶ 725, 305, 120–143",
      routingRules: {
        paragraphRanges: [{ from: 725, to: 725 }, { from: 305, to: 305 }, { from: 120, to: 143 }],
        resolutionRanges: [],
        tags: ["higher-ed", "ministry", "superintendent"],
      },
    },
    {
      name: "Independent Commissions",
      abbreviation: "IC",
      description: "GCORR, GCSRW, GCAH ¶¶ 740–750",
      routingRules: {
        paragraphRanges: [{ from: 740, to: 750 }],
        resolutionRanges: [],
        tags: ["race-relations", "women", "archives"],
      },
    },
    {
      name: "Judicial Administration",
      abbreviation: "JA",
      description: "Judicial council, complaints, trials ¶¶ 806–807, 900, 2701–2703",
      routingRules: {
        paragraphRanges: [{ from: 806, to: 807 }, { from: 900, to: 900 }, { from: 2701, to: 2703 }],
        resolutionRanges: [],
        tags: ["judicial", "judicial-administration", "complaints", "trials"],
      },
    },
    {
      name: "Local Church",
      abbreviation: "LC",
      description: "Local church organization ¶¶ 201–259",
      routingRules: {
        paragraphRanges: [{ from: 201, to: 259 }],
        resolutionRanges: [],
        tags: ["local-church"],
      },
    },
    {
      name: "Ordained Ministry",
      abbreviation: "OM",
      description: "District ministry committees, ordained ministry ¶¶ 301–370",
      routingRules: {
        paragraphRanges: [{ from: 301, to: 370 }],
        resolutionRanges: [],
        tags: ["district", "ordained", "candidacy"],
      },
    },
    {
      name: "Consent Calendar",
      abbreviation: "CC",
      description: "Administrative petitions for consent calendar processing",
      routingRules: {
        paragraphRanges: [],
        resolutionRanges: [],
        tags: [],
      },
    },
  ];

  for (const c of committees) {
    await prisma.committee.create({
      data: {
        name: c.name,
        abbreviation: c.abbreviation,
        description: c.description,
        routingRulesJson: c.routingRules,
      },
    });
  }
  console.log(`✅ ${committees.length} committees created`);

  // ============================================================
  // 6. Sample Users (7 roles)
  // ============================================================
  const passwordHash = hashSync("password123", 10);

  const _superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@gc2028.org",
      name: "Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  const _admin = await prisma.user.create({
    data: {
      email: "admin@gc2028.org",
      name: "Conference Admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  const _staff = await prisma.user.create({
    data: {
      email: "staff@gc2028.org",
      name: "Staff Member",
      passwordHash,
      role: "STAFF",
    },
  });

  const cs1Committee = await prisma.committee.findUnique({
    where: { abbreviation: "CS1" },
  });

  const chair = await prisma.user.create({
    data: {
      email: "chair@gc2028.org",
      name: "Committee Chair",
      passwordHash,
      role: "COMMITTEE_CHAIR",
      delegationConference: "North Texas Annual Conference",
    },
  });

  const member = await prisma.user.create({
    data: {
      email: "member@gc2028.org",
      name: "Committee Member",
      passwordHash,
      role: "COMMITTEE_MEMBER",
      delegationConference: "North Texas Annual Conference",
    },
  });

  const _delegate = await prisma.user.create({
    data: {
      email: "delegate@gc2028.org",
      name: "Delegate Smith",
      passwordHash,
      role: "DELEGATE",
      delegationConference: "North Texas Annual Conference",
    },
  });

  const _publicUser = await prisma.user.create({
    data: {
      email: "public@gc2028.org",
      name: "Public Observer",
      passwordHash,
      role: "PUBLIC",
    },
  });

  console.log("✅ 7 sample users created");

  // Create committee memberships
  if (cs1Committee) {
    await prisma.committeeMembership.create({
      data: {
        userId: chair.id,
        committeeId: cs1Committee.id,
        role: "CHAIR",
      },
    });
    await prisma.committeeMembership.create({
      data: {
        userId: member.id,
        committeeId: cs1Committee.id,
        role: "MEMBER",
      },
    });
    console.log("✅ Committee memberships created (Chair + Member → CS1)");
  }

  // ============================================================
  // Summary
  // ============================================================
  const counts = {
    conferences: await prisma.conference.count(),
    books: await prisma.book.count(),
    sections: await prisma.section.count(),
    paragraphs: await prisma.paragraph.count(),
    resolutions: await prisma.resolution.count(),
    committees: await prisma.committee.count(),
    users: await prisma.user.count(),
    memberships: await prisma.committeeMembership.count(),
  };

  console.log("\n📊 Seed Summary:");
  console.log(`   Conferences: ${counts.conferences}`);
  console.log(`   Books: ${counts.books}`);
  console.log(`   Sections: ${counts.sections}`);
  console.log(`   Paragraphs: ${counts.paragraphs}`);
  console.log(`   Resolutions: ${counts.resolutions}`);
  console.log(`   Committees: ${counts.committees}`);
  console.log(`   Users: ${counts.users}`);
  console.log(`   Committee Memberships: ${counts.memberships}`);
  console.log("\n✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
