"use strict";

const vscode = require("vscode");
const REMINDER_INTERVAL = 10 * 60 * 1000;
let lastReminderAt = 0;

const designChecklist = [
  ["Formalize Requirement Analysis", ["Write the specification before implementation starts. Have it reviewed and approved, and keep a record of the approved version and later changes.", "Write each requirement as one clear statement with a unique ID. It must be stable, unambiguous, implementable, and independently testable.", "Describe the expected behaviour, interfaces, limitations, quality, security, privacy, operations, and measurable acceptance criteria.", "Identify requirements that reduce risks, link them to the related risks and assumptions, and track them through design, code, tests, defects, and evidence."]],
  ["Define Architecture Before Implementation", ["Define and approve the architecture before implementation or AI-assisted code generation begins.", "Describe the system boundaries, components, responsibilities, dependencies, and main design views. Assign each requirement and risk control to an owner.", "Identify important assets, trust boundaries, possible failures, threats, and planned protections before implementation.", "Explain how safety, security, privacy, reliability, performance, and testability will be achieved and measured."]],
  ["Define Clear Interfaces & Contracts", ["Define and approve the rules for safety-critical, security-relevant, public, and cross-component interfaces before implementation.", "For each important interface, define its inputs, outputs, data format, protocol, states, timing, errors, owner, and version.", "Explain how the system checks input and handles missing, invalid, duplicated, unauthorized, late, or out-of-range data.", "Manage interface changes with versioning, impact analysis, review, approval, and a documented migration plan when needed."]]
];

const developmentChecklist = [
  ["Environment & Tooling baseline", [
    "Use only Philips-approved tools, models, extensions, MCP servers, plugins, agents, SDKs, and dependencies. Keep their versions, settings, and instructions identifiable, approved, version-controlled, security-reviewed, and reproducible.",
    "Apply least privilege to AI work: share only the minimum necessary context and restrict agent access to files, shell commands, networks, and credentials to what the task requires.",
    "Assign a named human engineer accountable for correctness, security, testing, compliance, and release readiness; record material AI assistance, the affected work, and the responsible engineer."
  ]],
  ["Implementation", [
    "Drive implementation and verification from approved requirements and design decisions, with measurable acceptance criteria defined before implementation and testing begin.",
    "Keep code and configuration changes traceable to work items, requirements, design, risks, tests, defects, and verification evidence; verify these links remain consistent during review.",
    "Before accepting generated code, understand its purpose, control flow, failure behaviour, data handling, and security implications; keep it within approved scope and review additional changes.",
    "Apply the same coding, architecture, complexity, documentation, maintainability, and secure-coding standards to AI-generated code as to human-written code.",
    "Before installing a dependency, review its origin, license, version, approval status, maintenance, known vulnerabilities, and suitability for the project.",
    "Keep credentials, tokens, patient data, and other confidential information out of source code, prompts, logs, test data, and generated artifacts."
  ]],
  ["Unit Verification", [
    "Test normal behaviour, boundaries, invalid input, errors, state transitions, important data conditions, and relevant control-flow paths.",
    "Have a human independently review AI-generated tests for weakened assertions, missing cases, unrealistic assumptions, and excessive mocking.",
    "Automate repeatable regression checks and run them again after changes that could affect the covered behaviour.",
    "When verification fails, correct the implementation or test cause without removing or weakening the test, and then verify again."
  ]],
  ["Code Review & Static Analysis", [
    "Obtain approval from a qualified human reviewer who understands the change and is not its sole author. AI review may add quality input but never replaces required human approval.",
    "Review the complete change set—including source, tests, lockfiles, instructions, build and CI/CD configuration, dependencies, and security controls—for specification, design, functionality, complexity, tests, documentation, and coding-standard compliance.",
    "Complete required compiler, lint, static security, secret, license, and dependency scans, and resolve their blocking findings.",
    "Correct, justify, or formally accept every review finding with the appropriate authority; merge only after acceptance criteria, quality gates, required approvals, and blocking comments are complete."
  ]]
];

const bestPractices = {
  design: {
    intro: "Optional guidance for design decisions that are expensive to change later. This does not replace the required checklist, human review, or approval.",
    groups: [
      ["Design for Change, Not Speculation", ["Give every module or service one clear responsibility, keep dependencies small, and hide implementation details behind stable boundaries.", "Build shared abstractions only when reuse is proven or clearly expected.", "Useful check: Can one module change without coordinated changes throughout the system?"]],
      ["Record Important Decisions Lightly", ["For consequential decisions, capture the context, decision, alternatives, trade-offs, and open assumptions. A short architecture decision record is usually enough.", "Useful check: Can a new team member understand why this approach was chosen?"]],
      ["Prove the Riskiest Assumption Early", ["Use a small spike, prototype, or integration experiment to test the uncertainty whose failure would cause the most rework.", "Useful check: Has the highest-risk assumption been tested before full implementation begins?"]],
      ["Design for Operability", ["Consider how a team will detect, diagnose, and recover from realistic failures, including slow or unavailable dependencies.", "Useful check: Could the team identify what failed and take a controlled recovery action?"]],
      ["Keep the First Version Deliberately Small", ["Plan a minimal, end-to-end outcome that proves user value. Defer extensions until the core path is understood and validated.", "Useful check: Does the first version deliver a verifiable outcome with the least necessary complexity?"]]
    ],
    skillGroups: [
      ["Context shaping", [
        ["Clarify open decisions — grill-with-docs", "Use when a request seems clear but important decisions, roles, access rules, success criteria, or failure behaviour are still missing."],
        ["Shape module boundaries — codebase-design", "Use when a feature is growing and responsibilities or dependencies need clear boundaries before coding."],
        ["Compare architecture options — Architecture Designer", "Use when choosing the technical shape of a new system or major service."],
        ["Challenge the proposal — /codex:adversarial-review", "Use before closing the design phase to actively look for assumptions, risks, privacy gaps, and failure modes."]
      ]]
    ]
  },
  development: {
    intro: "Optional daily engineering guidance. This does not replace the required checklist, human review, or approval.",
    groups: [
      ["Track Delivery Flow", ["Use team-level delivery signals—cycle time, throughput, lead time for changes, change failure rate, and work in progress—to identify where work slows down or quality risk builds up.", "Use these signals to improve the system of work, not to evaluate individual performance."]],
      ["Use a Consistent Code-Review Flow", ["Use one focused branch per feature or fix. Open a pull request with a clear description, linked work item, expected behaviour, and relevant test notes.", "Review logic, readability, standards, edge cases, and risk before approval. This complements, but does not replace, the required review and quality gates."]],
      ["Deliver in Small Batches", ["Split large stories before development starts and keep each pull request focused on one outcome. Separate unrelated refactoring, behaviour changes, and dependency upgrades whenever possible.", "Use feature flags when an incremental release reduces risk, and reconsider batch size if review time, cycle time, or rework grows."]],
      ["Collaborate Across the Delivery Team", ["Bring product, engineering, QA, security, and operations together early for planning, refinement, reviews, risk discussion, and release preparation.", "Make blockers and handoffs explicit so quality, security, testability, and operational constraints are addressed before deployment."]],
      ["Make Failures Safe and Observable", ["Validate inputs at boundaries, handle expected errors deliberately, and provide actionable logs without confidential data.", "Treat configuration as code: use safe defaults, validate it at startup, and avoid environment-specific assumptions."]],
      ["Protect Against Regression", ["When practical, reproduce a defect with a focused automated test before fixing it.", "Use clear names and simple control flow; document non-obvious decisions and trade-offs.", "Before handover, verify the user-visible outcome in a representative environment—not only that the code builds or tests pass."]]
    ],
    skillGroups: [
      ["Plan & implement", [
        ["Break work into reviewable units — /to-tickets", "Use when an approved specification is still too large to estimate, assign, or implement safely."],
        ["Implement a focused change — /implement", "Use when a ticket is understood and the work can move from plan to a focused code change."],
        ["Test-driven development — /tdd", "Use when important behaviour should be expressed in tests before implementation."],
        ["Improve codebase architecture", "Use when working code is becoming tangled, duplicated, or increasingly hard to change."]
      ]],
      ["Review & quality", [
        ["Qodo Code Review", "Use for a first-pass pull-request review against repository conventions and surrounding code."],
        ["GitHub Copilot Code Review", "Use for fast first-pass feedback on a GitHub pull request before human review."],
        ["DeepSource", "Use when automated quality and security checks should run on every change."],
        ["Prepare a pull request — check-pr", "Use before requesting review to catch missing context, failed checks, or undocumented configuration changes."],
        ["Iterate on review findings — greploop", "Use when a change needs repeated review-and-improve cycles before handover."]
      ]],
      ["Security", [
        ["Review a sensitive change — /security-review", "Use when a change handles authentication, user input, confidential data, or an external API."],
        ["Secure Code Guardian", "Use during design or implementation for security guidance on controls such as validation, replay protection, and secret storage."],
        ["Trail of Bits Skills", "Use when a high-risk component needs deeper security analysis than a normal code review."]
      ]],
      ["Diagnose, research & handover", [
        ["Diagnose a bug — diagnosing-bugs", "Use when something is broken but the cause or a reliable reproduction is not yet known."],
        ["Sustained investigation — /codex:rescue", "Use when a task is stuck, spans several files, or requires extended investigation."],
        ["IDE task execution — Continue Agent Mode", "Use when an approved assistant needs to inspect files, make changes, and run commands as one scoped task."],
        ["Create a handover — Handoff", "Use when work pauses and another person needs the issue, evidence, changed files, and next test captured clearly."],
        ["Research verified facts — research", "Use when a decision depends on current facts that should be checked in official documentation or other primary sources."]
      ]]
    ]
  }
};

const chapterBestPractices = {
  "Formalize Requirement Analysis": {
    title: "Requirements Analysis Best Practices",
    intro: "Optional guidance for turning a request into clear, testable, and traceable requirements.",
    groups: [["Make requirements usable", ["Write acceptance criteria in observable terms: given a context, describe the action and expected result.", "Separate user needs, constraints, assumptions, and open questions so they can be reviewed independently.", "Replace ambiguous words such as fast, secure, or easy with measurable thresholds."]]],
    skillGroups: [["Recommended skills", [["Clarify open decisions — grill-with-docs", "Use when requirements, roles, success criteria, or failure behaviour are unclear."], ["Break work into reviewable units — /to-tickets", "Use when an approved specification is still too large to estimate or implement safely."]]]]
  },
  "Define Architecture Before Implementation": {
    title: "Architecture Best Practices",
    intro: "Optional guidance for decisions that are expensive to change after implementation begins.",
    groups: [["Keep the design intentional", ["Give every component one clear responsibility and keep dependencies small.", "Capture consequential decisions with context, alternatives, trade-offs, and open assumptions.", "Prove the riskiest assumption early with a small spike, prototype, or integration experiment.", "Plan a minimal end-to-end outcome before adding optional complexity."]]],
    skillGroups: [["Recommended skills", [["Shape module boundaries — codebase-design", "Use when responsibilities or dependencies need to be clear before coding."], ["Compare architecture options — Architecture Designer", "Use when choosing the technical shape of a new system or major service."], ["Challenge the proposal — /codex:adversarial-review", "Use before closing design to find assumptions, risks, and failure modes."]]]]
  },
  "Define Clear Interfaces & Contracts": {
    title: "Interface & Contract Best Practices",
    intro: "Optional guidance for dependable boundaries between people, systems, and components.",
    groups: [["Design dependable boundaries", ["Make contracts explicit: types, ownership, versioning, errors, timeouts, and compatibility expectations.", "Validate input at the boundary and return predictable errors that callers can act on.", "Design for slow, unavailable, and partially failing dependencies; make retry and idempotency behaviour explicit.", "Treat interface changes as migrations, including consumer impact and rollback planning."]]],
    skillGroups: [["Recommended skills", [["Review a sensitive change — /security-review", "Use when an interface handles authentication, confidential data, or an external API."], ["Secure Code Guardian", "Use for guidance on validation, replay protection, and secret storage."]]]]
  },
  "Environment & Tooling baseline": {
    title: "Environment & Tooling Best Practices",
    intro: "Optional guidance for a controlled, reproducible, and safe development environment.",
    groups: [["Keep the environment trustworthy", ["Pin and document tool, model, SDK, and dependency versions so another engineer can reproduce the setup.", "Keep secrets outside source code, prompts, logs, and generated artifacts; rotate them when exposure is suspected.", "Apply least privilege to tools and agents, and review permission changes as security-relevant configuration."]]],
    skillGroups: [["Recommended skills", [["IDE task execution — Continue Agent Mode", "Use when an approved assistant needs a clearly scoped task with controlled access."], ["Research verified facts — research", "Use when a tool or dependency decision requires current primary-source information."]]]]
  },
  "Implementation": {
    title: "Implementation Best Practices",
    intro: "Optional guidance for focused, maintainable, and reviewable code changes.",
    groups: [["Build in small, safe increments", ["Keep each change focused on one outcome; separate unrelated refactoring, behaviour changes, and dependency upgrades.", "Prefer clear names and simple control flow; document non-obvious decisions and trade-offs.", "Validate inputs, handle expected errors deliberately, and log useful diagnostic information without confidential data.", "Reproduce a defect with a focused automated test before fixing it when practical."]]],
    skillGroups: [["Recommended skills", [["Implement a focused change — /implement", "Use when a ticket is understood and work can move to a focused code change."], ["Test-driven development — /tdd", "Use when important behaviour should be expressed in tests before implementation."], ["Improve codebase architecture", "Use when working code is becoming tangled, duplicated, or hard to change."]]]]
  },
  "Unit Verification": {
    title: "Unit Verification Best Practices",
    intro: "Optional guidance for tests that detect real regressions and give trustworthy feedback.",
    groups: [["Test meaningful behaviour", ["Test normal behaviour, boundaries, invalid input, errors, and important state transitions.", "Keep assertions specific enough to catch the intended regression; avoid tests that only confirm mocks were called.", "Use representative data and add a regression test whenever a defect is fixed.", "Run repeatable checks after every relevant change and investigate flaky tests rather than ignoring them."]]],
    skillGroups: [["Recommended skills", [["Test-driven development — /tdd", "Use when important behaviour should be captured in tests before implementation."], ["Diagnose a bug — diagnosing-bugs", "Use when a failure has no clear cause or reliable reproduction yet."]]]]
  },
  "Code Review & Static Analysis": {
    title: "Code Review & Static Analysis Best Practices",
    intro: "Optional guidance for a focused review that complements required approvals and quality gates.",
    groups: [["Review the whole change", ["Open a focused pull request with purpose, linked work item, expected behaviour, and test notes.", "Review source, tests, configuration, dependencies, and CI changes together—not just the primary code file.", "Use automated analysis early, resolve blocking findings, and record justified exceptions with the appropriate authority.", "Make handover explicit: capture changed files, evidence, known limits, and the next verification step."]]],
    skillGroups: [["Recommended skills", [["Qodo Code Review", "Use for a first-pass pull-request review against repository conventions."], ["GitHub Copilot Code Review", "Use for fast first-pass feedback before human review."], ["DeepSource", "Use when automated quality and security checks should run on every change."], ["Prepare a pull request — check-pr", "Use before requesting review to catch missing context or failed checks."], ["Iterate on review findings — greploop", "Use when a change needs repeated review-and-improve cycles."], ["Create a handover — Handoff", "Use when another person needs the issue, evidence, changed files, and next test captured clearly."]]]]
  }
};

const skillInstallations = {
  "Clarify open decisions — grill-with-docs": "Install: npx skills add mattpocock/skills",
  "Shape module boundaries — codebase-design": "Install: npx skills add mattpocock/skills",
  "Compare architecture options — Architecture Designer": "Install: /plugin marketplace add jeffallan/claude-skills",
  "Challenge the proposal — /codex:adversarial-review": "Install: /plugin marketplace add openai/codex-plugin-cc",
  "Break work into reviewable units — /to-tickets": "Install: npx skills add mattpocock/skills",
  "Implement a focused change — /implement": "Install: npx skills add mattpocock/skills",
  "Test-driven development — /tdd": "Install: npx skills add mattpocock/skills",
  "Improve codebase architecture": "Install: npx skills add mattpocock/skills",
  "Qodo Code Review": "Install: Create an account and connect the Git provider.",
  "GitHub Copilot Code Review": "Install: Enable Copilot code review in GitHub.",
  "DeepSource": "Install: Connect the repository through DeepSource.",
  "Prepare a pull request — check-pr": "Install: Clone the Greptile skills repository and install the skill.",
  "Iterate on review findings — greploop": "Install: Clone the Greptile skills repository and install the skill.",
  "Review a sensitive change — /security-review": "Install: Use /security-review in Claude Code.",
  "Secure Code Guardian": "Install: /plugin marketplace add jeffallan/claude-skills",
  "Trail of Bits Skills": "Install: /plugin marketplace add trailofbits/skills",
  "Diagnose a bug — diagnosing-bugs": "Install: npx skills add mattpocock/skills",
  "Sustained investigation — /codex:rescue": "Install: /plugin marketplace add openai/codex-plugin-cc",
  "IDE task execution — Continue Agent Mode": "Install: Install Continue, then switch to Agent mode.",
  "Create a handover — Handoff": "Install: npx skills add mattpocock/skills",
  "Research verified facts — research": "Install: npx skills add mattpocock/skills"
};

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("guideline-reminder.helloWorld", () => vscode.window.showInformationMessage("Hello World from Guideline Reminder!")),
    vscode.commands.registerCommand("guideline-reminder.showChecklist", () => openCurrentChecklist(context)),
    vscode.commands.registerCommand("guideline-reminder.designCheck", () => openChecklist(context, "design")),
    vscode.commands.registerCommand("guideline-reminder.restartDesign", async () => {
      await context.workspaceState.update("phase", "design");
      await context.workspaceState.update("checked.design", []);
      await context.workspaceState.update("checked.development", []);
      openChecklist(context, "design");
    }),
    vscode.commands.registerCommand("guideline-reminder.showBestPractices", () => chooseBestPractices(context, currentPhase(context))),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (!vscode.workspace.getConfiguration("guidelineReminder").get("enableOnSave", true)) return;
      if (context.workspaceState.get("phase") !== "development" || !isCodeFile(document) || Date.now() - lastReminderAt < REMINDER_INTERVAL) return;
      lastReminderAt = Date.now();
      vscode.window.showInformationMessage("Guideline reminder: review requirements, scope, tests, and security before continuing.", "Open checklist").then((choice) => choice === "Open checklist" && openCurrentChecklist(context));
    })
  );
}

function isCodeFile(document) { return document.uri.scheme === "file" && !["markdown", "plaintext", "json"].includes(document.languageId); }
function currentPhase(context) { return context.workspaceState.get("phase") === "development" ? "development" : "design"; }
function openCurrentChecklist(context) { return openChecklist(context, currentPhase(context)); }

function openChecklist(context, phase) {
  const isDesign = phase === "design";
  const groups = isDesign ? designChecklist : developmentChecklist;
  const key = `checked.${phase}`;
  const all = groups.flatMap(([, items]) => items);
  const checked = new Set(context.workspaceState.get(key, []));
  const panel = vscode.window.createWebviewPanel("guidelineReminderChecklist", isDesign ? "Phase 1 - Design" : "Phase 2-4 - Development, Verification & Review", vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
  const render = () => panel.webview.html = checklistPage(groups, checked, isDesign);
  panel.webview.onDidReceiveMessage(async ({ type, item }) => {
    if (type === "toggle") { checked.has(item) ? checked.delete(item) : checked.add(item); await context.workspaceState.update(key, [...checked]); render(); }
    if (type === "continue" && isDesign) {
      if (!all.every((item) => checked.has(item))) return vscode.window.showWarningMessage(`Complete all ${all.length} design checks before continuing.`);
      await context.workspaceState.update("phase", "development"); panel.dispose(); vscode.window.showInformationMessage("Design complete. Development checklist is now active."); openChecklist(context, "development");
    }
    if (type === "backToDesign" && !isDesign) {
      await context.workspaceState.update("phase", "design");
      panel.dispose();
      openChecklist(context, "design");
    }
    if (type === "bestPractices" && chapterBestPractices[item]) openBestPractices(chapterBestPractices[item]);
  });
  render();
}

async function chooseBestPractices(context, phase) {
  const groups = phase === "design" ? designChecklist : developmentChecklist;
  const chapter = await vscode.window.showQuickPick(groups.map(([title]) => title), { placeHolder: "Choose a checklist chapter" });
  if (chapter && chapterBestPractices[chapter]) openBestPractices(chapterBestPractices[chapter]);
}

function openBestPractices(content) {
  const panel = vscode.window.createWebviewPanel("guidelineReminderBestPractices", content.title, vscode.ViewColumn.Beside, { enableScripts: false, retainContextWhenHidden: true });
  panel.webview.html = bestPracticesPage(content);
}

function checklistPage(groups, checked, isDesign) {
  const all = groups.flatMap(([, items]) => items);
  const nonce = String(Date.now());
  const sections = groups.map(([title, items]) => `<section><h2>${escape(title)}</h2><button class="best-practice-link" data-chapter="${escape(title)}">View best practices for this chapter</button>${items.map((item) => `<label><input type="checkbox" data-item="${escape(item)}" ${checked.has(item) ? "checked" : ""}><span>${escape(item)}</span></label>`).join("")}</section>`).join("");
  const completed = all.filter((item) => checked.has(item)).length;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><style>body{max-width:1100px;margin:auto;padding:32px;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background)}header{display:flex;justify-content:space-between;border-bottom:1px solid var(--vscode-panel-border)}h2{color:var(--vscode-textLink-foreground);margin:30px 0 8px}label{display:flex;gap:14px;padding:14px;margin:8px 0;border:1px solid var(--vscode-panel-border);border-radius:6px;line-height:1.45}input{width:20px;height:20px;flex:none}button{padding:10px 18px;margin-right:8px;color:var(--vscode-button-foreground);background:var(--vscode-button-background);border:0;border-radius:4px;font:inherit}.best-practice-link{font-size:.9em;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}footer{display:flex;gap:8px;margin-top:28px}.secondary{color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground)}</style></head><body><header><div><h1>${isDesign ? "Phase 1 — Design checklist" : "Phase 2–4 — Development checklist"}</h1><p>Review every guideline before continuing.</p></div><strong>${completed} / ${all.length} complete</strong></header>${sections}<footer>${isDesign ? "" : "<button class=\"secondary\" data-action=\"backToDesign\">← Back to Design</button>"}${isDesign ? "<button data-action=\"continue\">Continue to Development →</button>" : ""}</footer><script nonce="${nonce}">const vscode=acquireVsCodeApi();document.querySelectorAll('input').forEach(x=>x.onchange=()=>vscode.postMessage({type:'toggle',item:x.dataset.item}));document.querySelectorAll('[data-chapter]').forEach(x=>x.onclick=()=>vscode.postMessage({type:'bestPractices',item:x.dataset.chapter}));document.querySelector('[data-action=\"continue\"]')?.addEventListener('click',()=>vscode.postMessage({type:'continue'}));document.querySelector('[data-action=\"backToDesign\"]')?.addEventListener('click',()=>vscode.postMessage({type:'backToDesign'}));</script></body></html>`;
}

function bestPracticesPage(content) {
  const sections = content.groups.map(([title, items]) => `<section><h2>${escape(title)}</h2>${items.map((item) => `<p>${escape(item)}</p>`).join("")}</section>`).join("");
  const skills = content.skillGroups.length ? `<section><h2>Recommended skills & tools (if approved)</h2><p>Use these optional skills and tools only when they are approved for use. They never replace the required checklist, human review, or approval.</p>${content.skillGroups.map(([group, entries]) => `<h3>${escape(group)}</h3>${entries.map(([title, description]) => `<article><h4>${escape(title)}</h4><p>${escape(description)}</p><p class="install">${escape(skillInstallations[title] || "Installation: Follow the approved marketplace instructions.")}</p></article>`).join("")}`).join("")}</section>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{max-width:900px;margin:auto;padding:32px;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);line-height:1.5}header{border-bottom:1px solid var(--vscode-panel-border)}h2{color:var(--vscode-textLink-foreground);margin-top:30px}h3{margin:24px 0 8px}h4{margin:0}p{margin:10px 0}article{padding:12px 16px;margin:10px 0;border-left:3px solid var(--vscode-textLink-foreground);background:var(--vscode-textBlockQuote-background)}.install{font-family:var(--vscode-editor-font-family);font-size:.9em;color:var(--vscode-textPreformat-foreground)}</style></head><body><header><h1>${escape(content.title)}</h1><p>${escape(content.intro)}</p></header>${sections}${skills}</body></html>`;
}

function escape(value) { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function deactivate() {}
module.exports = { activate, deactivate };
