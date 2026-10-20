import type { Researcher, SeedSignal } from "@/lib/types";

function signal(input: SeedSignal): SeedSignal {
  return input;
}

/**
 * Thirty fictional archetypes. Names, employers, papers, and dates are invented
 * for this case study. Nothing here is a claim about a real person.
 */
export const RESEARCHERS: Researcher[] = [
  {
    id: "r01",
    name: "Idris Pell",
    archetype: "World-model researcher, ex-game AI lab",
    roleType: "Research scientist",
    org: "Northglass Interactive",
    location: "Montreal",
    roleStart: "2025-11-09",
    focus: "Long-horizon world models that stay coherent long enough to play.",
    workHook: "the playable world-model work at Northglass",
    signals: [
      signal({
        type: "reorg",
        date: "2026-09-15",
        title: "World-model group moved under live games",
        detail:
          "Northglass posted that the research group now reports into the live-game organization. Idris’s title did not change. The charter did.",
        strength: 0.58,
      }),
      signal({
        type: "release",
        kind: "paper",
        date: "2026-09-25",
        title: "Eleven seconds of play",
        detail:
          "A workshop note on a game-engine world model that holds for about eleven seconds. Public on the Northglass research page. Not a flagship launch.",
        strength: 0.74,
      }),
    ],
  },
  {
    id: "r02",
    name: "Hana Quill",
    archetype: "Embodied RL researcher, ex-robotics startup",
    roleType: "Research scientist",
    org: "Brine Theory Lab",
    location: "Pittsburgh",
    roleStart: "2025-11-01",
    focus: "Footstep policies that transfer off the flat lab floor.",
    workHook: "the footstep policy in her latest lab note",
    signals: [
      signal({
        type: "funding",
        date: "2026-10-10",
        title: "Brine extended its robotics grant",
        detail:
          "Brine Theory Lab announced a public extension of its locomotion grant. New headcount was not named. A refresher conversation usually follows this kind of note by a few weeks.",
        strength: 0.6,
      }),
      signal({
        type: "release",
        kind: "paper",
        date: "2026-10-12",
        title: "Footsteps, not keyframes",
        detail:
          "Lab note on a policy that plans contact rather than replaying captured walks. Hana is the lead author on the Brine site.",
        strength: 0.7,
      }),
    ],
  },
  {
    id: "r03",
    name: "Mateo Ibarra",
    archetype: "Multimodal research engineer",
    roleType: "Research engineer",
    org: "Lowtide Models",
    location: "London",
    roleStart: "2026-04-06",
    focus: "Video-to-simulation checkpoints other teams can actually load.",
    workHook: "the Lowtide-Sim checkpoint he just shipped",
    signals: [
      signal({
        type: "funding",
        date: "2026-10-14",
        title: "Lowtide announced a growth round",
        detail:
          "Lowtide Models posted a public round earmarked for the simulation stack. The post promises a larger product org, which is the moment some researchers reassess.",
        strength: 0.9,
      }),
      signal({
        type: "release",
        kind: "model",
        date: "2026-10-16",
        title: "Lowtide-Sim 0.4",
        detail:
          "A downloadable checkpoint for short playable scenes. Mateo is listed as the release owner on the model card. Card went up three days before this clock.",
        strength: 0.98,
      }),
    ],
  },
  {
    id: "r04",
    name: "Sera Okoye",
    archetype: "Robotics research engineer",
    roleType: "Research engineer",
    org: "Fieldglass Robotics",
    location: "Boston",
    roleStart: "2024-10-27",
    focus: "Contact-rich picking from wrist cameras.",
    workHook: "her wrist-camera picking results",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-10-05",
        title: "Contact from the wrist camera",
        detail:
          "A Fieldglass tech report on grasp recovery when the overhead camera is occluded. Sera is first author. The report is public; the code is not.",
        strength: 0.64,
      }),
      signal({
        type: "layoff",
        date: "2026-10-14",
        title: "Fieldglass cut the research org",
        detail:
          "Fieldglass posted that the research organization would be smaller next quarter. This seed profile does not say whether Sera’s role was affected. Do not assume it was.",
        strength: 0.92,
      }),
    ],
  },
  {
    id: "r05",
    name: "Felix Drummond",
    archetype: "Open-models research engineer",
    roleType: "Research engineer",
    org: "Loom & Latent",
    location: "Berlin",
    roleStart: "2026-01-12",
    focus: "Small open video models with published training notes.",
    workHook: "the Loom-2 training note and the weights he just tagged",
    signals: [
      signal({
        type: "building",
        date: "2026-10-15",
        title: "Leaving the nightly-train rotation to start a new line",
        detail:
          "Felix posted, on his own site, that he is stepping off the shared training rotation to start a separate open-model line. He did not say he is leaving Loom & Latent.",
        strength: 0.86,
      }),
      signal({
        type: "oss",
        date: "2026-10-17",
        title: "Loom-2.1 weights and the recipe",
        detail:
          "A tagged release: weights, a short recipe, and a known-failure list. Felix is the maintainer on the repo. The failure list is the part worth writing about.",
        strength: 0.98,
      }),
    ],
  },
  {
    id: "r06",
    name: "Freya Lind",
    archetype: "Simulation research engineer",
    roleType: "Research engineer",
    org: "Westmere Simulation",
    location: "Stockholm",
    roleStart: "2025-05-12",
    focus: "Simulators that keep contact stable past a few seconds.",
    workHook: "the contact-stability numbers in the Westmere note",
    signals: [
      signal({
        type: "funding",
        date: "2026-10-13",
        title: "Westmere closed a public series B",
        detail:
          "Westmere Simulation announced a series B aimed at turning the research sim into a product surface. No new grant for the research group was named.",
        strength: 0.94,
      }),
      signal({
        type: "release",
        kind: "paper",
        date: "2026-10-16",
        title: "Contacts that do not explode",
        detail:
          "A Westmere research note on a contact solver that stays stable in longer rollouts. Freya is the corresponding author.",
        strength: 0.96,
      }),
    ],
  },
  {
    id: "r07",
    name: "Jules Marrow",
    archetype: "Game-AI research scientist",
    roleType: "Research scientist",
    org: "Kestrel Play Labs",
    location: "Los Angeles",
    roleStart: "2025-06-16",
    focus: "Opponent models that survive a balance patch.",
    workHook: "the patch-robust opponent model",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-09-20",
        title: "Opponents that survive the patch",
        detail:
          "Kestrel research note on an opponent model retrained against patch notes rather than raw replays. Jules is the lead.",
        strength: 0.66,
      }),
      signal({
        type: "talk",
        date: "2026-10-06",
        endsOn: "2026-11-12",
        title: "Opponent models that survive a patch",
        detail:
          "Listed on the fictional Harborlight Symposium program for a November session. Abstract matches the September note. Name matched to the Kestrel people page.",
        strength: 0.72,
      }),
      signal({
        type: "reorg",
        date: "2026-10-01",
        title: "Research now sits inside live-ops",
        detail:
          "Kestrel announced that the research group reports to live-ops. Jules posted nothing about it. The org chart note is the only public record.",
        strength: 0.48,
      }),
    ],
  },
  {
    id: "r08",
    name: "Noor Voss",
    archetype: "Open-source ML maintainer",
    roleType: "Member of technical staff",
    org: "Lampblack Collective",
    location: "Remote",
    roleStart: "2024-04-08",
    focus: "A small training library other labs actually pin.",
    workHook: "the Lampblack trainer release",
    signals: [
      signal({
        type: "funding",
        date: "2026-09-22",
        title: "A public grant for the trainer",
        detail:
          "Lampblack posted a modest public grant to keep the trainer maintained. It is not a venture round. It does change how urgent a job conversation is.",
        strength: 0.42,
      }),
      signal({
        type: "oss",
        date: "2026-10-08",
        title: "lampblack-train 0.9",
        detail:
          "Release notes call out a breaking change in the checkpoint format. Noor is the only maintainer on the repo. The migration note is the thing to have read.",
        strength: 0.8,
      }),
    ],
  },
  {
    id: "r09",
    name: "Arun Veld",
    archetype: "Evals and safety researcher",
    roleType: "Research scientist",
    org: "Candleline Institute",
    location: "Oxford",
    roleStart: "2026-01-12",
    focus: "Evaluations for agents that act in simulated worlds.",
    workHook: "the eval harness he says he is starting",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-09-28",
        title: "Did the agent touch the object",
        detail:
          "A short Candleline note on an eval that checks physical contact rather than final score. Arun is a coauthor, not the lead.",
        strength: 0.55,
      }),
      signal({
        type: "building",
        date: "2026-10-15",
        title: "Starting an eval harness in public",
        detail:
          "Arun posted that he is building a new eval harness on nights and that he is “not sure it fits inside Candleline.” First person, on his own site.",
        strength: 0.88,
      }),
    ],
  },
  {
    id: "r10",
    name: "Leona March",
    archetype: "Perception lab lead",
    roleType: "Lab lead",
    org: "Moth & Metric",
    location: "Zurich",
    roleStart: "2023-11-20",
    focus: "Perception stacks for messy indoor scenes.",
    workHook: "the indoor perception stack her lab just re-scoped",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-09-18",
        title: "Rooms, not benchmarks",
        detail:
          "A Moth & Metric report arguing their indoor set no longer matches the product cameras. Leona wrote the framing section.",
        strength: 0.5,
      }),
      signal({
        type: "reorg",
        date: "2026-10-02",
        title: "Perception lab folded toward product cameras",
        detail:
          "Moth & Metric announced the lab’s charter is now the product camera line. Leona is still listed as lab lead. The job she was hired for is narrower.",
        strength: 0.7,
      }),
    ],
  },
  {
    id: "r11",
    name: "Yara Benali",
    archetype: "Neural rendering researcher",
    roleType: "Research scientist",
    org: "Paper Lantern Systems",
    location: "Paris",
    roleStart: "2025-09-01",
    focus: "Real-time neural rendering for game frames.",
    workHook: "the real-time renderer she has been publishing toward",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-09-30",
        title: "A frame, not a scene",
        detail:
          "Workshop paper on caching a neural renderer per frame rather than per scene. Yara is first author. The results are early.",
        strength: 0.58,
      }),
      signal({
        type: "funding",
        date: "2026-10-11",
        title: "Paper Lantern raised a graphics round",
        detail:
          "Public round aimed at a graphics product. The research blog was not mentioned. Researchers often feel this as the week the company picks a surface.",
        strength: 0.78,
      }),
    ],
  },
  {
    id: "r12",
    name: "Theo Lang",
    archetype: "Planning applied scientist",
    roleType: "Applied scientist",
    org: "Silt & Signal",
    location: "Toronto",
    roleStart: "2026-08-03",
    focus: "Search-based planners for short-horizon game tasks.",
    workHook: "the planner he was hired to productionize",
    signals: [],
  },
  {
    id: "r13",
    name: "Mina Solt",
    archetype: "Multimodal postdoc",
    roleType: "Postdoctoral researcher",
    org: "Umber Lab",
    location: "Cambridge",
    roleStart: "2025-10-01",
    focus: "Grounding language instructions in short videos.",
    workHook: "the grounding note she put on the lab site",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-10-04",
        title: "Point at the thing, then the word",
        detail:
          "Umber Lab tech report on grounding an instruction in the frame where the object actually moves. Mina is first author. The one-year mark on her postdoc is already behind her.",
        strength: 0.76,
      }),
    ],
  },
  {
    id: "r14",
    name: "Ellis Navarro",
    archetype: "Video model research engineer",
    roleType: "Research engineer",
    org: "Halve Systems",
    location: "Seoul",
    roleStart: "2025-08-04",
    focus: "Short video models conditioned on a game state.",
    workHook: "the state-conditioned video checkpoint",
    signals: [
      signal({
        type: "reorg",
        date: "2026-09-20",
        title: "Video group split off from the foundation team",
        detail:
          "Halve posted a new video group with its own lead. Ellis is listed in the group. His previous manager is not.",
        strength: 0.4,
      }),
      signal({
        type: "release",
        kind: "model",
        date: "2026-10-09",
        title: "Halve-Play 0.2",
        detail:
          "A small state-conditioned video model. Ellis is the release owner. The model card is blunt about temporal drift after four seconds.",
        strength: 0.84,
      }),
    ],
  },
  {
    id: "r15",
    name: "Sable Rahman",
    archetype: "Training-systems staff engineer",
    roleType: "Staff research engineer",
    org: "Kiln Research",
    location: "Austin",
    roleStart: "2025-02-17",
    focus: "Making other people’s training runs recoverable.",
    workHook: "the checkpoint recovery tool she maintains",
    signals: [
      signal({
        type: "oss",
        date: "2026-09-12",
        title: "kiln-recover 1.4",
        detail:
          "A maintenance release of the recovery tool. Useful, not a launch. Sable is the maintainer. The interesting part is a new failure mode in the notes.",
        strength: 0.48,
      }),
    ],
  },
  {
    id: "r16",
    name: "Jonah Abebe",
    archetype: "Learning-theory postdoc",
    roleType: "Postdoctoral researcher",
    org: "Plover Lab",
    location: "Princeton",
    roleStart: "2026-02-02",
    focus: "Generalization bounds that assume a simulator, not a dataset.",
    workHook: "the simulator-assumption note from the spring",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-05-19",
        title: "Bounds when the world is a simulator",
        detail:
          "A spring workshop paper. Jonah is first author. Nothing public since. Included so the decay is visible: old proof does not make a week.",
        strength: 0.7,
      }),
    ],
  },
  {
    id: "r17",
    name: "Cassian Ortega",
    archetype: "Founding researcher, agents",
    roleType: "Founding researcher",
    org: "Juniper Circuit",
    location: "New York",
    roleStart: "2026-05-18",
    focus: "Agents that plan inside a game, not a browser.",
    workHook: "the agent runtime he says he is starting",
    signals: [
      signal({
        type: "oss",
        date: "2026-10-01",
        title: "juniper-loop 0.3",
        detail:
          "An early runtime for agent loops over a game API. Cassian maintains it. The release is real and small.",
        strength: 0.62,
      }),
      signal({
        type: "building",
        date: "2026-10-16",
        title: "Building the runtime as its own thing",
        detail:
          "Cassian posted that he is incorporating around the runtime and will keep a research seat at Juniper “for now.” Explicit, first person, three days before this clock.",
        strength: 0.94,
      }),
    ],
  },
  {
    id: "r18",
    name: "Nia Calder",
    archetype: "Game-tools applied scientist",
    roleType: "Applied scientist",
    org: "Redkettle Games",
    location: "Vancouver",
    roleStart: "2025-12-07",
    focus: "Tools that let designers steer a trained policy.",
    workHook: "the designer-facing policy tools",
    signals: [
      signal({
        type: "reorg",
        date: "2026-09-08",
        title: "Tools team moved under the design org",
        detail:
          "Redkettle announced the applied-science tools team now reports to design. Nia’s role title stayed “applied scientist.”",
        strength: 0.55,
      }),
      signal({
        type: "release",
        kind: "paper",
        date: "2026-09-29",
        title: "A slider for the policy",
        detail:
          "Internal-turned-public note on exposing three knobs of a policy to a designer. Nia is the author. Modest result.",
        strength: 0.5,
      }),
    ],
  },
  {
    id: "r19",
    name: "Omar Vetch",
    archetype: "Robot-learning research scientist",
    roleType: "Research scientist",
    org: "Vetiver Robotics",
    location: "Lausanne",
    roleStart: "2025-01-20",
    focus: "Manipulation policies that survive a camera move.",
    workHook: "the camera-move result in the Vetiver note",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-10-02",
        title: "When the camera moves, the grasp should not",
        detail:
          "Vetiver note on a policy trained with deliberate camera shifts. Omar is first author. The failure cases are pictured.",
        strength: 0.7,
      }),
      signal({
        type: "talk",
        date: "2026-10-09",
        endsOn: "2026-11-18",
        title: "Wrist cameras and the contact the sim skipped",
        detail:
          "Listed for a November session at the fictional Glasshouse Workshop. Abstract names the same camera-shift setup as the note.",
        strength: 0.6,
      }),
    ],
  },
  {
    id: "r20",
    name: "Lila Perrin",
    archetype: "Evaluation research scientist",
    roleType: "Research scientist",
    org: "Night School Applied",
    location: "Chicago",
    roleStart: "2024-08-12",
    focus: "Evals for policies that run inside games.",
    workHook: "her eval suite for in-game policies",
    signals: [
      signal({
        type: "layoff",
        date: "2026-09-13",
        title: "Night School reduced the applied group",
        detail:
          "Night School Applied posted a reduction in the applied research group more than a month ago. The post does not name Lila. The window on this signal has closed; the fact of it has not fully decayed.",
        strength: 0.9,
      }),
      signal({
        type: "release",
        kind: "paper",
        date: "2026-10-06",
        title: "Score the trajectory, not the win",
        detail:
          "A public eval note arguing win-rate hides policy collapse. Lila is first author. This is the live signal. The layoff is context, and it is not the opener.",
        strength: 0.68,
      }),
    ],
  },
  {
    id: "r21",
    name: "Hugo Stein",
    archetype: "Training-infra staff engineer",
    roleType: "Staff research engineer",
    org: "Copperline Studio",
    location: "Seattle",
    roleStart: "2024-09-02",
    focus: "Keeping long training runs resumable.",
    workHook: "the resumable-run work he owns",
    signals: [
      signal({
        type: "reorg",
        date: "2026-10-14",
        title: "Training infra merged into the product platform",
        detail:
          "Copperline announced the research-infra group is now part of the product platform team. Hugo is named as the staff engineer making the move. He has not posted about it himself.",
        strength: 0.8,
      }),
    ],
  },
  {
    id: "r22",
    name: "Amira Kent",
    archetype: "Physics simulation researcher",
    roleType: "Research scientist",
    org: "Second Weather",
    location: "Edinburgh",
    roleStart: "2024-11-08",
    focus: "Learned physics that stays conservative.",
    workHook: "the conservation results in the Second Weather note",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-10-07",
        title: "The energy has to go somewhere",
        detail:
          "Note on a learned simulator that reports where energy leaks. Amira is first author. It is the natural thing to cite if you write this month.",
        strength: 0.66,
      }),
      signal({
        type: "funding",
        date: "2026-10-08",
        title: "Second Weather named a public research gift",
        detail:
          "A university-style gift, publicly posted, earmarked for the simulator group. Smaller than a round. Enough to start a “what happens to the group” conversation.",
        strength: 0.55,
      }),
    ],
  },
  {
    id: "r23",
    name: "Wren Okada",
    archetype: "Perception research engineer",
    roleType: "Research engineer",
    org: "Static Garden",
    location: "Kyoto",
    roleStart: "2026-06-22",
    focus: "Detection for cluttered tabletops.",
    workHook: "the tabletop detector",
    signals: [
      signal({
        type: "oss",
        date: "2026-07-30",
        title: "garden-detect 0.1",
        detail:
          "A first public tag of a detector. Wren is a contributor, not the sole maintainer. Old enough that decay should bury it.",
        strength: 0.4,
      }),
    ],
  },
  {
    id: "r24",
    name: "Beatrice Holm",
    archetype: "Research lab lead, multimodal",
    roleType: "Lab lead",
    org: "Bright Meridian",
    location: "Copenhagen",
    roleStart: "2025-03-10",
    focus: "A small multimodal lab inside a product company.",
    workHook: "the lab’s last public model note",
    signals: [
      signal({
        type: "release",
        kind: "model",
        date: "2026-10-11",
        title: "Meridian-Join 0.3",
        detail:
          "A modest multimodal checkpoint. Beatrice is the lab lead on the card, with two engineers as the training owners. Recent enough to cite.",
        strength: 0.82,
      }),
      signal({
        type: "reorg",
        date: "2026-10-12",
        title: "The lab now reports to the product GM",
        detail:
          "Bright Meridian announced the research lab reports to the product general manager. Beatrice is still lab lead. The buffer between the lab and the roadmap is gone.",
        strength: 0.74,
      }),
      signal({
        type: "funding",
        date: "2026-10-15",
        title: "Bright Meridian raised on the product, not the lab",
        detail:
          "Public round. The announcement quotes the product roadmap and does not mention research. That omission is the signal.",
        strength: 0.7,
      }),
    ],
  },
  {
    id: "r25",
    name: "Samir Dalloway",
    archetype: "Planning research scientist",
    roleType: "Research scientist",
    org: "Cairn ML",
    location: "London",
    roleStart: "2024-05-06",
    focus: "Search methods that still work when the simulator is wrong.",
    workHook: "the simulator-error talk he is listed for",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-09-26",
        title: "Search after the model is wrong",
        detail:
          "Cairn note on planners that budget for simulator error instead of assuming it away. Samir is first author.",
        strength: 0.62,
      }),
      signal({
        type: "funding",
        date: "2026-10-12",
        title: "Cairn announced a planning-product bet",
        detail:
          "Cairn ML posted that a planning product, not the research group, is the next bet. The research headcount line was “unchanged for now.”",
        strength: 0.86,
      }),
      signal({
        type: "talk",
        date: "2026-10-02",
        endsOn: "2026-11-05",
        title: "Search after the simulator lies",
        detail:
          "Program listing at the fictional Circuit & Form meeting, session in the first week of November. Abstract tracks the September note.",
        strength: 0.7,
      }),
    ],
  },
  {
    id: "r26",
    name: "June Harth",
    archetype: "Robotics postdoc",
    roleType: "Postdoctoral researcher",
    org: "Glass Orchard",
    location: "Berkeley",
    roleStart: "2026-09-01",
    focus: "Just started. Tactile sensing for small grippers.",
    workHook: "the tactile-sensing direction she was hired for",
    signals: [],
  },
  {
    id: "r27",
    name: "Rafael Moss",
    archetype: "Video generation research scientist",
    roleType: "Research scientist",
    org: "Kindling Dynamics",
    location: "Los Angeles",
    roleStart: "2025-08-18",
    focus: "Longer video rollouts that do not forget the prompt.",
    workHook: "the prompt-drift result in the Kindling card",
    signals: [
      signal({
        type: "release",
        kind: "model",
        date: "2026-10-01",
        title: "Kindling-Roll 0.6",
        detail:
          "Model card for a longer rollout. Rafael is a lead author. The card is honest that prompts drift after a few seconds. That honesty is the hook.",
        strength: 0.78,
      }),
      signal({
        type: "reorg",
        date: "2026-09-05",
        title: "Generation research paired with the product studio",
        detail:
          "Kindling posted a pairing between the research group and the product studio. Rafael’s name is on the research side of the graphic.",
        strength: 0.36,
      }),
    ],
  },
  {
    id: "r28",
    name: "Tessa Bloom",
    archetype: "Agent researcher",
    roleType: "Member of technical staff",
    org: "Harborfold AI",
    location: "San Francisco",
    roleStart: "2026-04-14",
    focus: "Agents that can be interrupted mid-plan.",
    workHook: "the interruptible-agent sketch she posted",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-09-21",
        title: "Stop, the plan changed",
        detail:
          "Harborfold note on agents that replan when a human interrupts. Tessa is a coauthor. Solid, not the week’s main event.",
        strength: 0.52,
      }),
      signal({
        type: "building",
        date: "2026-10-01",
        title: "Sketching an interruptible agent in the open",
        detail:
          "Tessa posted a design sketch and wrote that she is “building this on the side to see if it wants to be a company.” Eighteen days ago. The half-life is already eating it.",
        strength: 0.8,
      }),
    ],
  },
  {
    id: "r29",
    name: "Kenji Mora",
    archetype: "Simulation research engineer, ex-game AI",
    roleType: "Research engineer",
    org: "Counterplay Research",
    location: "Tokyo",
    roleStart: "2025-11-30",
    focus: "Game simulators used as training worlds, not as products.",
    workHook: "the training-world simulator he is a year into",
    signals: [
      signal({
        type: "oss",
        date: "2026-09-28",
        title: "counterplay-sim 0.4",
        detail:
          "A minor tag. Kenji is a maintainer. The notes are short. It is not why you would write this week.",
        strength: 0.45,
      }),
      signal({
        type: "reorg",
        date: "2026-09-10",
        title: "Sim group asked to support a live title",
        detail:
          "Counterplay posted that the research sim will back a live title next year. Kenji is on the sim roster. The one-year mark is still ahead of him.",
        strength: 0.5,
      }),
    ],
  },
  {
    id: "r30",
    name: "Danae Ruiz",
    archetype: "Multimodal evaluation applied scientist",
    roleType: "Applied scientist",
    org: "Lowtide Models",
    location: "London",
    roleStart: "2024-02-12",
    focus: "Evals for the same stack Mateo ships models on.",
    workHook: "the eval side of Lowtide, which just got moved",
    signals: [
      signal({
        type: "release",
        kind: "paper",
        date: "2026-09-08",
        title: "What the checkpoint fails in public",
        detail:
          "An eval note on failure modes of an earlier Lowtide checkpoint. Danae is first author. Useful context, not a launch.",
        strength: 0.5,
      }),
      signal({
        type: "reorg",
        date: "2026-10-07",
        title: "Evals folded into the product group",
        detail:
          "Lowtide announced evals now sit in the product group, separate from the research release line. Danae is named. Mateo, on the same fictional employer, is not; his signal is the checkpoint, not this move.",
        strength: 0.84,
      }),
    ],
  },
];
