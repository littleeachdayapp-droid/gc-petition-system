import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

// ============================================================
// DATA ARRAYS
// ============================================================

const ANNUAL_CONFERENCES = [
  "Alabama-West Florida", "Alaska", "Baltimore-Washington", "California-Nevada",
  "California-Pacific", "Central Texas", "Dakotas", "Desert Southwest",
  "East Ohio", "Eastern Pennsylvania", "Florida", "Greater New Jersey",
  "Holston", "Illinois Great Rivers", "Indiana", "Iowa",
  "Kansas East", "Kentucky", "Louisiana", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Mountain Sky",
  "Nebraska", "New England", "New York", "North Alabama",
  "North Carolina", "North Georgia", "North Texas", "Northern Illinois",
  "Northwest Texas", "Ohio Valley", "Oklahoma", "Oregon-Idaho",
  "Pacific Northwest", "Peninsula-Delaware", "Red Bird Missionary", "Rio Texas",
  "Rocky Mountain", "South Carolina", "South Georgia", "Susquehanna",
  "Tennessee-Western Kentucky", "Texas", "Upper New York", "Virginia",
  "West Michigan", "West Ohio", "West Virginia", "Western North Carolina",
  "Western Pennsylvania", "Wisconsin", "Yellowstone",
  "Congo Central", "East Africa", "Germany", "Philippines", "West Africa",
];

const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Dorothy", "Paul", "Kimberly", "Andrew", "Emily", "Joshua", "Donna",
  "Kenneth", "Michelle", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
  "Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna", "Stephen", "Brenda",
  "Larry", "Pamela", "Justin", "Emma", "Scott", "Nicole", "Brandon", "Helen",
  "Benjamin", "Samantha", "Samuel", "Katherine", "Raymond", "Christine", "Gregory", "Debra",
  "Frank", "Rachel", "Alexander", "Carolyn", "Patrick", "Janet", "Jack", "Catherine",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill",
  "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell",
  "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
  "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales",
  "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson",
  "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward",
  "Richardson", "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray",
  "Mendoza", "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel",
  "Myers", "Long", "Ross", "Foster",
];

// Petition titles organized by committee domain
const PETITION_TEMPLATES: Record<string, Array<{ title: string; summary: string; rationale: string }>> = {
  "social-principles": [
    { title: "Amend Social Principles Preamble on Human Dignity", summary: "Updates the preamble to explicitly affirm human dignity for all persons.", rationale: "The current preamble lacks explicit language on human dignity." },
    { title: "Strengthen Environmental Stewardship Language", summary: "Adds specific commitments to carbon reduction and environmental justice.", rationale: "Climate change demands stronger denominational commitment." },
    { title: "Update Language on Economic Justice", summary: "Revises economic justice sections to address modern inequality.", rationale: "Economic conditions have changed significantly since last revision." },
    { title: "Expand the Nurturing Community Provisions", summary: "Broadens the definition of nurturing communities to include digital spaces.", rationale: "Modern ministry includes significant online community building." },
  ],
  "local-church": [
    { title: "Simplify Local Church Organization Requirements", summary: "Reduces mandatory committee structures for small-membership churches.", rationale: "Small churches struggle to fill all required committee positions." },
    { title: "Update Membership Transfer Process", summary: "Streamlines the process for transferring membership between local churches.", rationale: "Current process creates unnecessary delays and paperwork." },
    { title: "Revise Church Council Composition", summary: "Allows flexible church council composition based on congregation size.", rationale: "One-size-fits-all governance does not serve all churches well." },
    { title: "Modernize Property Management Requirements", summary: "Updates property management guidelines to include digital assets.", rationale: "Churches now hold significant digital property and online presence." },
  ],
  "ordained-ministry": [
    { title: "Revise Candidacy Requirements for Ordained Ministry", summary: "Updates educational and experiential requirements for ministry candidates.", rationale: "Current requirements create unnecessary barriers for qualified candidates." },
    { title: "Strengthen Continuing Education for Clergy", summary: "Establishes minimum continuing education requirements for active clergy.", rationale: "Ministry effectiveness requires ongoing professional development." },
    { title: "Update Appointment-Making Process", summary: "Provides greater transparency in the appointment-making process.", rationale: "Clergy and congregations deserve more voice in appointments." },
    { title: "Create Bi-Vocational Ministry Pathway", summary: "Establishes a formal pathway for bi-vocational ordained ministry.", rationale: "Many effective ministers serve in bi-vocational capacities." },
  ],
  "constitution": [
    { title: "Amend Constitutional Provisions on Conference Structure", summary: "Updates conference structure to reflect current global realities.", rationale: "The denomination has changed significantly since last constitutional revision." },
    { title: "Strengthen Restrictive Rules Protection", summary: "Adds additional safeguards to the restrictive rules amendment process.", rationale: "Constitutional protections need stronger procedural safeguards." },
    { title: "Revise Jurisdictional Conference Boundaries", summary: "Updates the process for adjusting jurisdictional boundaries.", rationale: "Population shifts require boundary adjustments for equitable representation." },
  ],
  "general-agency": [
    { title: "Restructure General Board of Church and Society", summary: "Reorganizes GBCS to improve efficiency and accountability.", rationale: "Current structure creates redundancy and unclear accountability." },
    { title: "Consolidate General Agency Functions", summary: "Merges overlapping functions across general agencies.", rationale: "Multiple agencies perform similar functions, wasting resources." },
    { title: "Strengthen Connectional Table Authority", summary: "Expands the Connectional Table's coordination role.", rationale: "Better coordination would improve denominational effectiveness." },
  ],
  "finance": [
    { title: "Reform Apportionment Calculation Formula", summary: "Updates the formula for calculating annual conference apportionments.", rationale: "Current formula does not accurately reflect church capacity." },
    { title: "Require Financial Transparency Standards", summary: "Establishes minimum financial transparency requirements for all levels.", rationale: "Trust requires openness in financial management." },
    { title: "Create Emergency Fund Provisions", summary: "Establishes denominational emergency financial reserves.", rationale: "Recent crises revealed inadequate financial reserves." },
  ],
  "judicial": [
    { title: "Reform Church Trial Procedures", summary: "Updates trial procedures to ensure fairness and due process.", rationale: "Current procedures lack adequate protections for accused persons." },
    { title: "Strengthen Judicial Council Independence", summary: "Adds protections for Judicial Council independence from political pressure.", rationale: "Judicial independence is essential for rule of law in the church." },
    { title: "Revise Complaint Resolution Process", summary: "Streamlines the complaint resolution process for greater efficiency.", rationale: "Current process takes too long and creates unnecessary suffering." },
  ],
  "conferences": [
    { title: "Update Annual Conference Session Requirements", summary: "Provides flexibility in annual conference meeting formats.", rationale: "Pandemic experience showed value of hybrid and virtual meetings." },
    { title: "Revise Central Conference Autonomy Provisions", summary: "Expands central conference authority over contextual matters.", rationale: "Global contexts require greater flexibility in application of Discipline." },
    { title: "Strengthen District Superintendent Accountability", summary: "Adds accountability measures for district superintendents.", rationale: "Superintendents need clearer performance expectations." },
  ],
  "discipleship": [
    { title: "Update Baptismal Theology Statement", summary: "Revises the theological statement on baptism for clarity.", rationale: "Current language creates confusion about baptismal theology." },
    { title: "Strengthen Christian Education Standards", summary: "Updates standards for Sunday school and Christian education programs.", rationale: "Educational methods have evolved significantly." },
    { title: "Revise Worship Resource Guidelines", summary: "Updates guidelines for worship resources and hymnals.", rationale: "Worship practices have diversified beyond current guidelines." },
  ],
  "global-ministries": [
    { title: "Expand Mission Partnership Models", summary: "Creates new models for international mission partnerships.", rationale: "Traditional mission models need updating for mutual partnership." },
    { title: "Strengthen Disaster Response Coordination", summary: "Improves coordination between UMCOR and annual conferences.", rationale: "Recent disasters revealed coordination gaps." },
  ],
  "resolutions": [
    { title: "Adopt Resolution on Immigration Justice", summary: "Calls for comprehensive immigration reform and church advocacy.", rationale: "Immigration remains a critical justice issue for the church." },
    { title: "Renew Resolution on Climate Action", summary: "Updates climate action commitments with specific goals.", rationale: "Previous resolution targets need updating with current science." },
    { title: "Adopt Resolution on Gun Violence Prevention", summary: "Calls for evidence-based gun violence prevention measures.", rationale: "Gun violence continues to devastate communities." },
    { title: "Adopt Resolution on Health Care Access", summary: "Affirms access to health care as a basic human right.", rationale: "Millions still lack adequate health care coverage." },
    { title: "Renew Resolution on Racial Justice", summary: "Updates denominational commitments to racial justice and reconciliation.", rationale: "Ongoing racial injustice demands renewed church commitment." },
  ],
};

const ACTION_TYPES = ["AMEND", "ADD", "REPLACE", "DELETE", "RENAME", "RESTRUCTURE", "NEW_RESOLUTION"] as const;
const ACTION_WEIGHTS = [40, 25, 15, 10, 3, 4, 3]; // distribution weights
const CHANGE_TYPES = ["ADD_TEXT", "DELETE_TEXT", "REPLACE_TEXT", "ADD_PARAGRAPH", "DELETE_PARAGRAPH", "RESTRUCTURE"] as const;
const TARGET_BOOKS = ["DISCIPLINE", "RESOLUTIONS", "BOTH"] as const;

// Status distribution for 1,200 petitions
const STATUS_DISTRIBUTION = {
  DRAFT: 120,
  SUBMITTED: 120,
  UNDER_REVIEW: 100,
  IN_COMMITTEE: 200,
  AMENDED: 80,
  APPROVED_BY_COMMITTEE: 150,
  REJECTED_BY_COMMITTEE: 80,
  ON_CALENDAR: 100,
  ADOPTED: 150,
  DEFEATED: 70,
  WITHDRAWN: 30,
} as const;

// ============================================================
// HELPERS
// ============================================================

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted<T>(items: readonly T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("=== Mass Seed Script ===\n");
  const startTime = Date.now();

  // ============================================================
  // Phase 1: Lookup existing data
  // ============================================================
  console.log("Phase 1: Looking up existing data...");

  const conference = await prisma.conference.findFirst({ where: { isActive: true } });
  if (!conference) throw new Error("No active conference found. Run base seed first.");

  const committees = await prisma.committee.findMany();
  if (committees.length === 0) throw new Error("No committees found. Run base seed first.");

  const paragraphs = await prisma.paragraph.findMany({ select: { id: true, number: true, categoryTags: true } });
  const resolutions = await prisma.resolution.findMany({ select: { id: true, resolutionNumber: true } });

  if (paragraphs.length === 0) throw new Error("No paragraphs found. Run base seed first.");

  const existingPetitionCount = await prisma.petition.count();
  const existingUserCount = await prisma.user.count();
  const existingDisplayNumbers = await prisma.petition.count({ where: { displayNumber: { not: null } } });

  console.log(`  Conference: ${conference.name} (${conference.year})`);
  console.log(`  Committees: ${committees.length}`);
  console.log(`  Paragraphs: ${paragraphs.length}, Resolutions: ${resolutions.length}`);
  console.log(`  Existing petitions: ${existingPetitionCount}, users: ${existingUserCount}`);

  // ============================================================
  // Phase 2: Create ~800 delegates
  // ============================================================
  console.log("\nPhase 2: Creating delegates...");

  const passwordHash = hashSync("password123", 4); // low cost for speed
  const delegateData: Array<{
    email: string;
    name: string;
    passwordHash: string;
    role: "DELEGATE";
    delegationConference: string;
  }> = [];

  const usedEmails = new Set<string>();
  let delegateIndex = 0;

  for (const conf of ANNUAL_CONFERENCES) {
    const delegateCount = randomInt(10, 16);
    for (let i = 0; i < delegateCount; i++) {
      delegateIndex++;
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const email = `delegate${delegateIndex}@gc2028.org`;

      if (usedEmails.has(email)) continue;
      usedEmails.add(email);

      delegateData.push({
        email,
        name: `${firstName} ${lastName}`,
        passwordHash,
        role: "DELEGATE",
        delegationConference: conf,
      });
    }
  }

  // Batch create in chunks of 200
  for (let i = 0; i < delegateData.length; i += 200) {
    const chunk = delegateData.slice(i, i + 200);
    await prisma.user.createMany({ data: chunk, skipDuplicates: true });
  }

  const delegates = await prisma.user.findMany({
    where: { role: "DELEGATE", email: { startsWith: "delegate" } },
    select: { id: true, name: true },
  });

  console.log(`  Created ${delegates.length} delegates across ${ANNUAL_CONFERENCES.length} conferences`);

  // ============================================================
  // Phase 3: Create committee memberships (~50 per committee)
  // ============================================================
  console.log("\nPhase 3: Creating committee memberships...");

  const shuffledDelegates = shuffle(delegates);
  const membershipData: Array<{
    userId: string;
    committeeId: string;
    role: "CHAIR" | "VICE_CHAIR" | "SECRETARY" | "MEMBER";
  }> = [];

  let delegatePool = [...shuffledDelegates];
  for (const committee of committees) {
    if (committee.abbreviation === "CC") continue; // skip consent calendar

    const memberCount = randomInt(45, 55);
    if (delegatePool.length < memberCount) {
      delegatePool = shuffle([...shuffledDelegates]);
    }

    const members = delegatePool.splice(0, memberCount);
    members.forEach((d, i) => {
      let role: "CHAIR" | "VICE_CHAIR" | "SECRETARY" | "MEMBER" = "MEMBER";
      if (i === 0) role = "CHAIR";
      else if (i === 1) role = "VICE_CHAIR";
      else if (i === 2) role = "SECRETARY";

      membershipData.push({
        userId: d.id,
        committeeId: committee.id,
        role,
      });
    });
  }

  await prisma.committeeMembership.createMany({
    data: membershipData,
    skipDuplicates: true,
  });

  const membershipCount = await prisma.committeeMembership.count();
  console.log(`  Created ${membershipData.length} memberships (total: ${membershipCount})`);

  // ============================================================
  // Phase 4: Create 1,200 petitions in batches
  // ============================================================
  console.log("\nPhase 4: Creating 1,200 petitions...");

  // Build flat list of petitions with their target statuses
  const petitionSpecs: Array<{
    status: string;
    templateKey: string;
    template: { title: string; summary: string; rationale: string };
  }> = [];

  const templateKeys = Object.keys(PETITION_TEMPLATES);

  for (const [status, count] of Object.entries(STATUS_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) {
      const key = pick(templateKeys);
      const template = pick(PETITION_TEMPLATES[key]);
      petitionSpecs.push({ status, templateKey: key, template });
    }
  }

  // Shuffle so statuses are interleaved
  const shuffledSpecs = shuffle(petitionSpecs);

  let displayNumberCounter = existingDisplayNumbers;
  const createdPetitionIds: Array<{ id: string; status: string; specIndex: number }> = [];

  // Create in batches of 100 using interactive transactions
  for (let batch = 0; batch < shuffledSpecs.length; batch += 100) {
    const batchSpecs = shuffledSpecs.slice(batch, batch + 100);

    const batchPetitions = await prisma.$transaction(async (tx) => {
      const results: Array<{ id: string; status: string; specIndex: number }> = [];

      for (let i = 0; i < batchSpecs.length; i++) {
        const spec = batchSpecs[i];
        const submitter = pick(delegates);
        const actionType = pickWeighted(ACTION_TYPES, ACTION_WEIGHTS);
        const targetBook = pick([...TARGET_BOOKS]);
        const variation = randomInt(1, 999);

        let displayNumber: string | null = null;
        if (spec.status !== "DRAFT") {
          displayNumberCounter++;
          displayNumber = `P-${conference.year}-${String(displayNumberCounter).padStart(4, "0")}`;
        }

        const petition = await tx.petition.create({
          data: {
            title: `${spec.template.title} (${variation})`,
            summary: spec.template.summary,
            rationale: spec.template.rationale,
            status: spec.status as never,
            actionType,
            targetBook,
            submitterId: submitter.id,
            conferenceId: conference.id,
            displayNumber,
          },
        });

        results.push({ id: petition.id, status: spec.status, specIndex: batch + i });
      }

      return results;
    });

    createdPetitionIds.push(...batchPetitions);
    process.stdout.write(`  Batch ${Math.floor(batch / 100) + 1}/${Math.ceil(shuffledSpecs.length / 100)} (${batchPetitions.length} petitions)\r`);
  }

  console.log(`\n  Created ${createdPetitionIds.length} petitions`);

  // ============================================================
  // Phase 5: Create petition targets (1-2 per petition)
  // ============================================================
  console.log("\nPhase 5: Creating petition targets...");

  const targetData: Array<{
    petitionId: string;
    paragraphId: string | null;
    resolutionId: string | null;
    changeType: string;
    proposedText: string | null;
  }> = [];

  for (const p of createdPetitionIds) {
    const targetCount = randomInt(1, 2);
    for (let t = 0; t < targetCount; t++) {
      const useResolution = resolutions.length > 0 && Math.random() < 0.35;
      const changeType = pick([...CHANGE_TYPES]);

      if (useResolution) {
        const resolution = pick(resolutions);
        targetData.push({
          petitionId: p.id,
          paragraphId: null,
          resolutionId: resolution.id,
          changeType,
          proposedText: changeType !== "DELETE_TEXT" && changeType !== "DELETE_PARAGRAPH"
            ? `Proposed amendment text for resolution ${resolution.resolutionNumber}.`
            : null,
        });
      } else {
        const paragraph = pick(paragraphs);
        targetData.push({
          petitionId: p.id,
          paragraphId: paragraph.id,
          resolutionId: null,
          changeType,
          proposedText: changeType !== "DELETE_TEXT" && changeType !== "DELETE_PARAGRAPH"
            ? `Proposed amendment text for paragraph ${paragraph.number}.`
            : null,
        });
      }
    }
  }

  // Batch create targets
  for (let i = 0; i < targetData.length; i += 500) {
    const chunk = targetData.slice(i, i + 500);
    await prisma.petitionTarget.createMany({ data: chunk as never });
  }

  console.log(`  Created ${targetData.length} petition targets`);

  // ============================================================
  // Phase 6: Create ORIGINAL versions for non-DRAFT petitions
  // ============================================================
  console.log("\nPhase 6: Creating petition versions...");

  const nonDraftPetitions = createdPetitionIds.filter((p) => p.status !== "DRAFT");
  const staffUser = await prisma.user.findFirst({ where: { role: "STAFF" } });
  if (!staffUser) throw new Error("No STAFF user found");

  const versionData: Array<{
    petitionId: string;
    versionNum: number;
    stage: string;
    snapshotJson: object;
    createdById: string;
  }> = [];

  for (const p of nonDraftPetitions) {
    versionData.push({
      petitionId: p.id,
      versionNum: 1,
      stage: "ORIGINAL",
      snapshotJson: { title: "Snapshot", status: "SUBMITTED" },
      createdById: staffUser.id,
    });
  }

  // Add COMMITTEE_AMENDED versions for ~50% of later-stage petitions
  const laterStage = createdPetitionIds.filter((p) =>
    ["AMENDED", "APPROVED_BY_COMMITTEE", "ON_CALENDAR", "ADOPTED", "DEFEATED"].includes(p.status)
  );
  const amendedSubset = laterStage.filter(() => Math.random() < 0.5);

  for (const p of amendedSubset) {
    versionData.push({
      petitionId: p.id,
      versionNum: 2,
      stage: "COMMITTEE_AMENDED",
      snapshotJson: { title: "Committee amended snapshot", status: p.status },
      createdById: staffUser.id,
    });
  }

  for (let i = 0; i < versionData.length; i += 500) {
    const chunk = versionData.slice(i, i + 500);
    await prisma.petitionVersion.createMany({ data: chunk as never });
  }

  console.log(`  Created ${versionData.length} petition versions (${nonDraftPetitions.length} ORIGINAL + ${amendedSubset.length} COMMITTEE_AMENDED)`);

  // ============================================================
  // Phase 7: Create assignments for non-DRAFT/SUBMITTED petitions
  // ============================================================
  console.log("\nPhase 7: Creating petition assignments...");

  const assignablePetitions = createdPetitionIds.filter((p) =>
    !["DRAFT", "SUBMITTED"].includes(p.status)
  );

  // Build a simple mapping: assign to a random non-CC committee
  const nonCCCommittees = committees.filter((c) => c.abbreviation !== "CC");
  const assignmentData: Array<{
    petitionId: string;
    committeeId: string;
    status: string;
  }> = [];

  const assignedPairs = new Set<string>();

  for (const p of assignablePetitions) {
    const committee = pick(nonCCCommittees);
    const key = `${p.id}-${committee.id}`;
    if (assignedPairs.has(key)) continue;
    assignedPairs.add(key);

    let assignmentStatus = "PENDING";
    if (["IN_COMMITTEE"].includes(p.status)) {
      assignmentStatus = "IN_PROGRESS";
    } else if (["APPROVED_BY_COMMITTEE", "REJECTED_BY_COMMITTEE", "AMENDED", "ON_CALENDAR", "ADOPTED", "DEFEATED"].includes(p.status)) {
      assignmentStatus = "COMPLETED";
    } else if (p.status === "WITHDRAWN") {
      assignmentStatus = pick(["PENDING", "DEFERRED"]);
    }

    assignmentData.push({
      petitionId: p.id,
      committeeId: committee.id,
      status: assignmentStatus,
    });
  }

  for (let i = 0; i < assignmentData.length; i += 500) {
    const chunk = assignmentData.slice(i, i + 500);
    await prisma.petitionAssignment.createMany({ data: chunk as never, skipDuplicates: true });
  }

  console.log(`  Created ${assignmentData.length} assignments`);

  // ============================================================
  // Phase 8: Create committee actions
  // ============================================================
  console.log("\nPhase 8: Creating committee actions...");

  // Fetch actual assignments for petitions that need actions
  const actionableStatuses = [
    "APPROVED_BY_COMMITTEE", "REJECTED_BY_COMMITTEE", "AMENDED",
    "ON_CALENDAR", "ADOPTED", "DEFEATED",
  ];
  const actionablePetitionIds = createdPetitionIds
    .filter((p) => actionableStatuses.includes(p.status))
    .map((p) => p.id);

  const assignments = await prisma.petitionAssignment.findMany({
    where: { petitionId: { in: actionablePetitionIds } },
    select: { id: true, committeeId: true, petitionId: true },
  });

  // Map petition status to committee action type
  const statusToAction: Record<string, string> = {
    APPROVED_BY_COMMITTEE: "APPROVE",
    REJECTED_BY_COMMITTEE: "REJECT",
    AMENDED: "AMEND_AND_APPROVE",
    ON_CALENDAR: "APPROVE",
    ADOPTED: "APPROVE",
    DEFEATED: "APPROVE", // committee approved, plenary defeated
  };

  const petitionStatusMap = new Map(createdPetitionIds.map((p) => [p.id, p.status]));
  const actionData: Array<{
    assignmentId: string;
    committeeId: string;
    action: string;
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
    notes: string | null;
  }> = [];

  for (const a of assignments) {
    const pStatus = petitionStatusMap.get(a.petitionId);
    if (!pStatus) continue;

    const action = statusToAction[pStatus] || "APPROVE";
    const totalVotes = randomInt(35, 55);
    const votesFor = action === "REJECT" ? randomInt(5, 15) : randomInt(25, totalVotes);
    const votesAgainst = action === "REJECT" ? randomInt(25, totalVotes - 5) : randomInt(0, totalVotes - votesFor);
    const votesAbstain = Math.max(0, totalVotes - votesFor - votesAgainst);

    actionData.push({
      assignmentId: a.id,
      committeeId: a.committeeId,
      action,
      votesFor,
      votesAgainst,
      votesAbstain,
      notes: null,
    });
  }

  for (let i = 0; i < actionData.length; i += 500) {
    const chunk = actionData.slice(i, i + 500);
    await prisma.committeeAction.createMany({ data: chunk as never });
  }

  console.log(`  Created ${actionData.length} committee actions`);

  // ============================================================
  // Phase 9: Create plenary sessions
  // ============================================================
  console.log("\nPhase 9: Creating plenary sessions...");

  const sessions: Array<{ id: string; sessionNumber: number }> = [];
  const startDate = new Date("2028-04-23");

  for (let day = 0; day < 10; day++) {
    for (const timeBlock of ["MORNING", "AFTERNOON"] as const) {
      const sessionNumber = day * 2 + (timeBlock === "MORNING" ? 1 : 2);
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);

      const session = await prisma.plenarySession.create({
        data: {
          conferenceId: conference.id,
          sessionNumber,
          date,
          timeBlock,
          notes: `Day ${day + 1} ${timeBlock.toLowerCase()} session`,
        },
      });
      sessions.push({ id: session.id, sessionNumber });
    }
  }

  console.log(`  Created ${sessions.length} plenary sessions`);

  // ============================================================
  // Phase 10: Create calendar items
  // ============================================================
  console.log("\nPhase 10: Creating calendar items...");

  const calendarStatuses = ["ON_CALENDAR", "ADOPTED", "DEFEATED"];
  const calendarPetitions = createdPetitionIds.filter((p) =>
    calendarStatuses.includes(p.status)
  );

  const calendarTypes = ["CONSENT", "REGULAR", "SPECIAL_ORDER"] as const;
  const calendarWeights = [20, 70, 10];

  const calendarItemData: Array<{
    id?: string;
    plenarySessionId: string;
    petitionId: string;
    calendarType: string;
    orderNumber: number;
  }> = [];

  // Track order numbers per session
  const sessionOrders = new Map<string, number>();

  for (const p of calendarPetitions) {
    const session = pick(sessions);
    const currentOrder = sessionOrders.get(session.id) || 0;
    const nextOrder = currentOrder + 1;
    sessionOrders.set(session.id, nextOrder);

    calendarItemData.push({
      plenarySessionId: session.id,
      petitionId: p.id,
      calendarType: pickWeighted(calendarTypes, calendarWeights),
      orderNumber: nextOrder,
    });
  }

  // Need to create individually due to unique constraint on (sessionId, orderNumber)
  // But we've managed order numbers correctly, so batch create should work
  const createdCalendarItems: Array<{ id: string; petitionId: string }> = [];

  for (let i = 0; i < calendarItemData.length; i += 100) {
    const chunk = calendarItemData.slice(i, i + 100);
    // Create individually to capture IDs
    for (const item of chunk) {
      try {
        const created = await prisma.calendarItem.create({
          data: item as never,
        });
        createdCalendarItems.push({ id: created.id, petitionId: created.petitionId });
      } catch {
        // Skip duplicates (same session + order)
      }
    }
  }

  console.log(`  Created ${createdCalendarItems.length} calendar items`);

  // ============================================================
  // Phase 11: Create plenary votes for ADOPTED/DEFEATED petitions
  // ============================================================
  console.log("\nPhase 11: Creating plenary votes...");

  const votablePetitions = createdPetitionIds.filter((p) =>
    ["ADOPTED", "DEFEATED"].includes(p.status)
  );

  const calendarItemMap = new Map(createdCalendarItems.map((c) => [c.petitionId, c.id]));

  const voteData: Array<{
    calendarItemId: string;
    action: string;
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
    notes: string | null;
  }> = [];

  for (const p of votablePetitions) {
    const calendarItemId = calendarItemMap.get(p.id);
    if (!calendarItemId) continue;

    const action = p.status === "ADOPTED" ? "ADOPT" : "DEFEAT";
    const totalVotes = randomInt(600, 800);
    const votesFor = action === "ADOPT" ? randomInt(400, totalVotes) : randomInt(100, 300);
    const votesAgainst = action === "ADOPT" ? randomInt(0, totalVotes - votesFor) : randomInt(400, totalVotes - votesFor);
    const votesAbstain = Math.max(0, totalVotes - votesFor - votesAgainst);

    voteData.push({
      calendarItemId,
      action,
      votesFor,
      votesAgainst,
      votesAbstain,
      notes: null,
    });
  }

  for (let i = 0; i < voteData.length; i += 500) {
    const chunk = voteData.slice(i, i + 500);
    await prisma.plenaryAction.createMany({ data: chunk as never });
  }

  console.log(`  Created ${voteData.length} plenary votes`);

  // ============================================================
  // Summary
  // ============================================================
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const counts = {
    users: await prisma.user.count(),
    delegates: await prisma.user.count({ where: { role: "DELEGATE" } }),
    memberships: await prisma.committeeMembership.count(),
    petitions: await prisma.petition.count(),
    targets: await prisma.petitionTarget.count(),
    versions: await prisma.petitionVersion.count(),
    assignments: await prisma.petitionAssignment.count(),
    actions: await prisma.committeeAction.count(),
    sessions: await prisma.plenarySession.count(),
    calendarItems: await prisma.calendarItem.count(),
    plenaryVotes: await prisma.plenaryAction.count(),
  };

  console.log(`\n=== Mass Seed Complete (${elapsed}s) ===`);
  console.log(`  Users: ${counts.users} (${counts.delegates} delegates)`);
  console.log(`  Committee Memberships: ${counts.memberships}`);
  console.log(`  Petitions: ${counts.petitions}`);
  console.log(`  Targets: ${counts.targets}`);
  console.log(`  Versions: ${counts.versions}`);
  console.log(`  Assignments: ${counts.assignments}`);
  console.log(`  Committee Actions: ${counts.actions}`);
  console.log(`  Plenary Sessions: ${counts.sessions}`);
  console.log(`  Calendar Items: ${counts.calendarItems}`);
  console.log(`  Plenary Votes: ${counts.plenaryVotes}`);
}

main()
  .catch((e) => {
    console.error("Mass seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
