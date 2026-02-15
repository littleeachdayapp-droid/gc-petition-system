import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding sample petitions from ADCA 2020...\n");

  // Get conference
  const conference = await prisma.conference.findFirst({ where: { isActive: true } });
  if (!conference) {
    console.error("No active conference found. Run main seed first.");
    process.exit(1);
  }

  // Get a delegate user to be the submitter
  const delegate = await prisma.user.findFirst({ where: { role: "DELEGATE" } });
  const publicUser = await prisma.user.findFirst({ where: { role: "PUBLIC" } });
  const chair = await prisma.user.findFirst({ where: { role: "COMMITTEE_CHAIR" } });
  if (!delegate || !publicUser || !chair) {
    console.error("Need seed users. Run main seed first.");
    process.exit(1);
  }

  // Get books
  const discipline = await prisma.book.findFirst({ where: { title: { contains: "Discipline" } } });
  const resolutions = await prisma.book.findFirst({ where: { title: { contains: "Resolutions" } } });
  if (!discipline || !resolutions) {
    console.error("Need seed books. Run main seed first.");
    process.exit(1);
  }

  // Get some paragraphs for targets
  const para160 = await prisma.paragraph.findFirst({ where: { number: 160 } });
  const para161 = await prisma.paragraph.findFirst({ where: { number: 161 } });
  const para162 = await prisma.paragraph.findFirst({ where: { number: 162 } });
  const para163 = await prisma.paragraph.findFirst({ where: { number: 163 } });
  const para304 = await prisma.paragraph.findFirst({ where: { number: 304 } });
  const para340 = await prisma.paragraph.findFirst({ where: { number: 340 } });
  const para604 = await prisma.paragraph.findFirst({ where: { number: 604 } });

  // Get some committees
  const committees = await prisma.committee.findMany();
  const cs1 = committees.find(c => c.abbreviation === "CS1") || committees[0];
  const cs2 = committees.find(c => c.abbreviation === "CS2") || committees[1];
  const conf = committees.find(c => c.abbreviation === "CO") || committees[2];
  const disc = committees.find(c => c.abbreviation === "DI") || committees[3];
  const fa = committees.find(c => c.abbreviation === "FA") || committees[4];
  const lc = committees.find(c => c.abbreviation === "LC") || committees[5];

  // Counter for display numbers
  let petitionNum = 1;
  function nextDisplayNumber() {
    return `P-2028-${String(petitionNum++).padStart(4, "0")}`;
  }

  const petitions = [
    // === SUBMITTED (awaiting routing) ===
    {
      title: "Community of All Creation Social Principles",
      displayNumber: nextDisplayNumber(),
      summary: "Delete ¶160 (The Natural World) and substitute revised Community of All Creation social principles with expanded theological grounding.",
      rationale: "The revised Social Principles increase theological grounding, succinctness, and global relevance as mandated by the 2012 General Conference.",
      actionType: "REPLACE",
      targetBook: "DISCIPLINE",
      status: "SUBMITTED",
      submitterId: delegate.id,
      conferenceId: conference.id,
      targets: para160 ? [{
        paragraphId: para160.id,
        changeType: "REPLACE_TEXT",
        currentText: "¶160. The Natural World — All creation is the Lord's, and we are responsible for the ways in which we use and abuse it.",
        proposedText: "¶160. Community of All Creation — We affirm that all creation belongs to God and is a manifestation of God's goodness and providential care. Human beings, nonhuman animals, plants, and other sentient and nonsentient beings participate in the community of creation.",
      }] : [],
    },
    {
      title: "Resolution for Climate Rescue",
      displayNumber: nextDisplayNumber(),
      summary: "Call upon all world leaders to enact plans for the world to be 100 percent carbon neutral by no later than 2050.",
      rationale: "The world is quickly approaching a point of no return, after which the catastrophic effects of climate change will be irreversible. The Social Principles state the whole earth is God's good creation and has inherent value.",
      actionType: "ADD",
      targetBook: "RESOLUTIONS",
      status: "SUBMITTED",
      submitterId: publicUser.id,
      conferenceId: conference.id,
      targets: [],
    },
    {
      title: "Use of Plastic Reduction Strategy",
      displayNumber: nextDisplayNumber(),
      summary: "Implement a comprehensive avoid-and-reduce strategy for plastic use at all levels of church gatherings and ministries.",
      rationale: "As UMC we are committed to responsible stewardship of God's creation. Plastic production causes greenhouse gas emissions of 850 million tons in 2019 alone.",
      actionType: "ADD",
      targetBook: "RESOLUTIONS",
      status: "SUBMITTED",
      submitterId: delegate.id,
      conferenceId: conference.id,
      targets: [],
    },

    // === UNDER_REVIEW (routed but not yet in committee) ===
    {
      title: "Building an LGBTQ Inclusive Church",
      displayNumber: nextDisplayNumber(),
      summary: "Amend ¶161.C on marriage and ¶161.G on human sexuality to remove exclusionary language.",
      rationale: "Given the recent response to the General Conference, this petition seeks to remove language that is harmful to LGBTQ persons and their families.",
      actionType: "AMEND",
      targetBook: "DISCIPLINE",
      status: "UNDER_REVIEW",
      submitterId: delegate.id,
      conferenceId: conference.id,
      targets: para161 ? [{
        paragraphId: para161.id,
        changeType: "REPLACE_TEXT",
        currentText: "¶161.C Marriage — We affirm the sanctity of the marriage covenant that is expressed in love, mutual support, personal commitment, and shared fidelity between a man and a woman.",
        proposedText: "¶161.C Marriage — We affirm the sanctity of the marriage covenant that is expressed in love, mutual support, personal commitment, and shared fidelity between two people.",
      }] : [],
      assignTo: cs2,
    },
    {
      title: "Reparations for Slavery",
      displayNumber: nextDisplayNumber(),
      summary: "Call on The United Methodist Church to formally apologize for its participation in and profit from slavery of African Americans.",
      rationale: "Address the fundamental injustice, cruelty, brutality, and inhumanity of slavery in the United States and to demand a national apology and proposal for reparations.",
      actionType: "ADD",
      targetBook: "RESOLUTIONS",
      status: "UNDER_REVIEW",
      submitterId: publicUser.id,
      conferenceId: conference.id,
      targets: [],
      assignTo: cs1,
    },

    // === IN_COMMITTEE ===
    {
      title: "Rights of Persons with Disabilities",
      displayNumber: nextDisplayNumber(),
      summary: "Amend ¶162.G to strengthen language regarding the rights and full inclusion of persons with disabilities in all aspects of church life.",
      rationale: "Persons with disabilities continue to face barriers to full participation in the life of the church. Updated language reflects current understanding of disability rights.",
      actionType: "AMEND",
      targetBook: "DISCIPLINE",
      status: "IN_COMMITTEE",
      submitterId: delegate.id,
      conferenceId: conference.id,
      targets: para162 ? [{
        paragraphId: para162.id,
        changeType: "REPLACE_TEXT",
        currentText: "¶162.G Rights of Persons with Disabilities — We recognize and affirm the full humanity and personhood of all individuals with mental, physical, developmental, neurological, and psychological conditions.",
        proposedText: "¶162.G Rights of Persons with Disabilities — We recognize, affirm, and celebrate the full humanity, personhood, and sacred worth of all individuals with disabilities. We commit to removing barriers to full participation in all aspects of church life including worship, education, leadership, and employment.",
      }] : [],
      assignTo: cs2,
    },
    {
      title: "Rural Peoples' Right to Sustainable Livelihood",
      displayNumber: nextDisplayNumber(),
      summary: "Amend ¶162.O to expand protections for rural communities facing economic displacement from industrial agriculture.",
      rationale: "Rural communities worldwide face increasing economic pressure from corporate agriculture. The church must speak prophetically about land rights and sustainable farming.",
      actionType: "AMEND",
      targetBook: "DISCIPLINE",
      status: "IN_COMMITTEE",
      submitterId: chair.id,
      conferenceId: conference.id,
      targets: para162 ? [{
        paragraphId: para162.id,
        changeType: "REPLACE_TEXT",
        currentText: "¶162.O Rural Peoples' Right — We support the right of rural peoples to sustainable livelihood and land.",
        proposedText: "¶162.O Rural Peoples' Right to Sustainable Livelihood — We support the right of rural peoples to sustainable livelihood, equitable access to arable land, clean water, and fair markets. We oppose corporate practices that displace family farms and indigenous agricultural communities.",
      }] : [],
      assignTo: cs1,
    },
    {
      title: "Strengthen Annual Conference Structure",
      displayNumber: nextDisplayNumber(),
      summary: "Amend ¶604 to clarify annual conference organizational requirements and improve accountability measures.",
      rationale: "Annual conferences need clearer structural guidelines to ensure effective governance and mission alignment.",
      actionType: "AMEND",
      targetBook: "DISCIPLINE",
      status: "IN_COMMITTEE",
      submitterId: delegate.id,
      conferenceId: conference.id,
      targets: para604 ? [{
        paragraphId: para604.id,
        changeType: "REPLACE_TEXT",
        currentText: "¶604. Organization of the Annual Conference.",
        proposedText: "¶604. Organization of the Annual Conference — Each annual conference shall organize to carry out its mission with clear lines of accountability, regular review of program effectiveness, and transparent financial reporting.",
      }] : [],
      assignTo: conf,
    },

    // === APPROVED_BY_COMMITTEE ===
    {
      title: "On Humility, Politics, and Christian Unity",
      displayNumber: nextDisplayNumber(),
      summary: "Add a new resolution calling United Methodists to practice humility in political discourse and prioritize Christian unity over partisan identity.",
      rationale: "Political polarization has infiltrated the church. We need a prophetic word calling for humility and unity across political differences.",
      actionType: "ADD",
      targetBook: "RESOLUTIONS",
      status: "APPROVED_BY_COMMITTEE",
      submitterId: delegate.id,
      conferenceId: conference.id,
      targets: [],
      assignTo: cs1,
    },
    {
      title: "Climate Justice and Environmental Racism",
      displayNumber: nextDisplayNumber(),
      summary: "Add new resolution addressing the disproportionate impact of environmental degradation on communities of color and low-income communities.",
      rationale: "Environmental hazards disproportionately affect marginalized communities. The church must address environmental racism as a matter of justice.",
      actionType: "ADD",
      targetBook: "RESOLUTIONS",
      status: "APPROVED_BY_COMMITTEE",
      submitterId: publicUser.id,
      conferenceId: conference.id,
      targets: [],
      assignTo: cs1,
    },

    // === ON_CALENDAR ===
    {
      title: "Revision of Social Principles Preamble",
      displayNumber: nextDisplayNumber(),
      summary: "Replace the preamble to the Social Principles with updated language reflecting the global nature of the church.",
      rationale: "The current preamble was written primarily from a US perspective. As a global church, our Social Principles must reflect the diverse contexts of all United Methodists.",
      actionType: "REPLACE",
      targetBook: "DISCIPLINE",
      status: "ON_CALENDAR",
      submitterId: delegate.id,
      conferenceId: conference.id,
      targets: para160 ? [{
        paragraphId: para160.id,
        changeType: "REPLACE_TEXT",
        currentText: "The United Methodist Church has a long history of concern for social justice.",
        proposedText: "As a global church rooted in the Wesleyan tradition, The United Methodist Church is committed to engaging the social issues of our time with theological depth, cultural humility, and prophetic courage.",
      }] : [],
      assignTo: cs1,
    },

    // === ADOPTED ===
    {
      title: "Support for Immigrant and Refugee Rights",
      displayNumber: nextDisplayNumber(),
      summary: "Amend ¶162.H to strengthen the church's commitment to welcoming immigrants and refugees and opposing family separation.",
      rationale: "In a political climate where immigrants and refugees increasingly live in fear, the church must affirm its prophetic witness for the rights and dignity of all people.",
      actionType: "AMEND",
      targetBook: "DISCIPLINE",
      status: "ADOPTED",
      submitterId: delegate.id,
      conferenceId: conference.id,
      targets: para162 ? [{
        paragraphId: para162.id,
        changeType: "REPLACE_TEXT",
        currentText: "¶162.H Rights of Immigrants — We recognize that no human being is illegal and affirm the rights of immigrants.",
        proposedText: "¶162.H Rights of Immigrants and Refugees — We recognize that no human being is illegal. We affirm the rights, dignity, and sacred worth of all immigrants and refugees. We oppose policies of family separation, indefinite detention, and militarization of borders.",
      }] : [],
      assignTo: cs2,
    },
    {
      title: "Mental Health and the Church",
      displayNumber: nextDisplayNumber(),
      summary: "Add a new resolution calling congregations to become informed, supportive communities for persons living with mental illness.",
      rationale: "Mental illness affects millions worldwide. The church must be a place of welcome, not stigma, for persons and families affected by mental health conditions.",
      actionType: "ADD",
      targetBook: "RESOLUTIONS",
      status: "ADOPTED",
      submitterId: chair.id,
      conferenceId: conference.id,
      targets: [],
      assignTo: cs2,
    },

    // === DEFEATED ===
    {
      title: "Mandatory Clergy Term Limits",
      displayNumber: nextDisplayNumber(),
      summary: "Amend ¶340 to establish mandatory 8-year term limits for clergy appointments at any single local church.",
      rationale: "Long pastoral tenures can lead to stagnation. Regular pastoral transitions bring fresh perspectives and prevent unhealthy dependencies.",
      actionType: "AMEND",
      targetBook: "DISCIPLINE",
      status: "DEFEATED",
      submitterId: publicUser.id,
      conferenceId: conference.id,
      targets: para340 ? [{
        paragraphId: para340.id,
        changeType: "REPLACE_TEXT",
        currentText: "¶340. Appointment of Ordained Ministers.",
        proposedText: "¶340. Appointment of Ordained Ministers — No ordained minister shall be appointed to the same local church for more than eight consecutive years without a mandatory review and reappointment process.",
      }] : [],
      assignTo: disc,
    },
    {
      title: "Abolish Guaranteed Appointment",
      displayNumber: nextDisplayNumber(),
      summary: "Delete provisions in ¶304 guaranteeing appointment for ordained elders in full connection.",
      rationale: "Guaranteed appointment limits the ability of bishops and cabinets to deploy clergy effectively and address performance concerns.",
      actionType: "DELETE",
      targetBook: "DISCIPLINE",
      status: "DEFEATED",
      submitterId: delegate.id,
      conferenceId: conference.id,
      targets: para304 ? [{
        paragraphId: para304.id,
        changeType: "DELETE_TEXT",
        currentText: "¶304. Qualifications for Ordination — All ordained elders in full connection shall be guaranteed an appointment.",
        proposedText: "",
      }] : [],
      assignTo: disc,
    },
  ];

  for (const p of petitions) {
    const { targets, assignTo, ...petitionData } = p;

    const petition = await prisma.petition.create({
      data: petitionData,
    });

    // Create targets
    for (const t of targets) {
      await prisma.petitionTarget.create({
        data: {
          petitionId: petition.id,
          paragraphId: t.paragraphId,
          changeType: t.changeType as "REPLACE_TEXT" | "ADD_TEXT" | "DELETE_TEXT" | "ADD_PARAGRAPH" | "DELETE_PARAGRAPH" | "RESTRUCTURE",
          proposedText: t.proposedText,
        },
      });
    }

    // Create ORIGINAL version for non-DRAFT petitions
    const snapshotTargets = targets.map(t => ({
      changeType: t.changeType,
      currentText: t.currentText,
      proposedText: t.proposedText,
    }));

    await prisma.petitionVersion.create({
      data: {
        petitionId: petition.id,
        versionNum: 1,
        stage: "ORIGINAL",
        createdById: petitionData.submitterId,
        snapshotJson: {
          title: petitionData.title,
          summary: petitionData.summary,
          rationale: petitionData.rationale,
          targets: snapshotTargets,
        },
      },
    });

    // Create assignment if applicable
    if (assignTo && ["UNDER_REVIEW", "IN_COMMITTEE", "APPROVED_BY_COMMITTEE", "ON_CALENDAR", "ADOPTED", "DEFEATED"].includes(petitionData.status)) {
      const assignmentStatus = ["APPROVED_BY_COMMITTEE", "ON_CALENDAR", "ADOPTED", "DEFEATED"].includes(petitionData.status)
        ? "COMPLETED"
        : "IN_PROGRESS";

      await prisma.petitionAssignment.create({
        data: {
          petitionId: petition.id,
          committeeId: assignTo.id,
          status: assignmentStatus,
        },
      });
    }

    console.log(`✅ ${petition.displayNumber} — ${petition.title} [${petition.status}]`);
  }

  console.log(`\n📊 Seeded ${petitions.length} petitions`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
