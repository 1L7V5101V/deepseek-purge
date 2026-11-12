# DeepSeek Harness

DeepSeek Harness (dsh) is an all-plugin agent harness on the vendored Cordis framework: the model adapter, tool registry, session log, and agent loop are all plugins composed into a named profile. This context's language covers composition, sessions, agents, capabilities, and the policies around them. Formal cross-linked reference entries live in [docs/glossary.md](docs/glossary.md); this file is the ubiquitous-language word list — one canonical term per concept, with the words to avoid.

## Language

### The harness

**Harness**:
The complete assembled product — a booted plugin tree plus the session domain — that a profile names for launch.
_Avoid_: framework (Cordis is the framework), platform, runtime

**Harness home**:
The per-user installation directory that stores profiles, user bundles, and patch files.
_Avoid_: config directory, data directory

**Profile**:
A named plugin composition stored in the Harness home: the bundles it stacks, any out-of-tree plugins it installs, and the user's own patch file.
_Avoid_: application, configuration, preset

**Bundle**:
A distribution format that packages Cordis config rows together with the code they mount, so whatever it inserts stays patchable from the layers above.
_Avoid_: package, plugin pack, extension pack

**Patch**:
A row-level change to the composed tree: it replaces one row's whole config or inserts new rows, applied in ordered layers over the bundles.
_Avoid_: override, config edit

**Plugin tree**:
The composed context of plugins, services, typed events, and reversible effects that a booted profile is.
_Avoid_: application, stack, runtime

### Sessions and the loop

**Session**:
A durable conversation record of one agent run, owned by an append-only event log.
_Avoid_: conversation, thread, chat, workspace

**Session log**:
The append-only, durable event stream of a session; the source of truth from which model history, resumes, transcripts, and telemetry derive.
_Avoid_: history, transcript, memory

**Conversation**:
The client-side presentation of a session assembled from its events; a rendering, never a separate record.
_Avoid_: chat, thread, session

**Model-visible input**:
Anything that reaches a model request; the invariant holds that every model-visible input is reconstructable from the session log.
_Avoid_: prompt, context

**Turn**:
One drain of admitted input in a session; it opens when input is claimed and closes once nothing is owed, containing zero or more steps.
_Avoid_: exchange, iteration, cycle

**Step**:
One model request plus the tool executions caused by its response; a turn contains zero or more steps.
_Avoid_: request, call, iteration

**Round**:
An outer policy iteration that contains a turn, such as a goal round or a Ralph round; round counters belong to the policy, not to the session.
_Avoid_: attempt, cycle

**Message**:
A committed conversation entry in the log — user, assistant, or system.
_Avoid_: response, completion, chat line

**Attempt**:
A settled assistant generation that failed, was retried, or was cancelled; it stays in the log but never becomes model history.
_Avoid_: error record, failed message, retry

**Fork**:
Creating a new session seeded from an existing session's state at a turn boundary.
_Avoid_: branch, copy, duplicate

**Resume**:
Continuing a stored session from its log.
_Avoid_: restore, reload, replay (replay is the recorded-session replay mode)

### Agents, scope, and delegation

**Agent**:
The live harness-side entity that owns a session and runs its loop.
_Avoid_: model, bot, worker

**Subagent**:
A delegated child agent started during a turn, with its own session and loop.
_Avoid_: worker, helper, child process

**Scope**:
The unit of per-agent registration: a contribution is global (visible to every agent) or scoped (owned by exactly one agent — the scope's key).
_Avoid_: context, realm, sandbox

**Lineage**:
The parent/child facts connecting a session to its delegating session, carried as data; it never affects visibility.
_Avoid_: hierarchy, scope inheritance, scope tree

**Agent preset**:
A named composition of one agent kind's capabilities and configuration.
_Avoid_: profile, template, persona

### Capabilities

**Seam**:
A swappable capability with three roles — a Service Definition, one or more Service Providers, and Consumers; the complete capability, never one role on its own.
_Avoid_: interface, abstraction, extension point

**Provider**:
The role that implements a seam's Service Definition.
_Avoid_: adapter, backend, driver

**Consumer**:
The role that injects and uses a seam's service, commonly a model-facing tool.
_Avoid_: caller, client, user

**Extension point**:
The surface where new behavior attaches without changing the loop: a service key, an event, or an effect.
_Avoid_: hook, seam, API

### Objectives and policy

**Goal**:
One durable completion objective attached to an existing session, with a revisioned phase and a goal-round cap.
_Avoid_: task, todo, objective (objective is reserved for Ralph's immutable objective)

**Goal round**:
One continuation cycle admitted for the current goal, materialized as one goal-sourced turn.
_Avoid_: retry, attempt, turn

**Goal activation**:
The process-local permission to admit another goal round, either armed or disarmed; durable replay does not restore it, so a human must re-authorize.
_Avoid_: enabled flag, on/off state

**Ralph loop**:
A foreground fresh-agent workflow run toward an immutable objective — a model-facing policy that starts a fresh child session per round.
_Avoid_: retry loop, agent loop, scheduler

**Ralph round**:
One fresh child session within a Ralph loop, seeded with no parent conversation.
_Avoid_: attempt, retry, iteration

**Ralph handoff**:
The bounded structured report — status, summary, evidence, next steps, blocker text — carried from one Ralph round to the next.
_Avoid_: summary dump, context dump, memory

**Workflow**:
A pre-scripted run of bounded steps that executes as one unit in the harness.
_Avoid_: script, pipeline, recipe

**Job**:
Background work the harness tracks while the loop continues, addressable by a branded id.
_Avoid_: process, worker, task

### Human interaction

**Human command**:
A slash-prefixed instruction a human-facing adapter executes directly, never sent to the model.
_Avoid_: slash command, chat command, tool

**Command plane**:
Discovery, parsing, dispatch, cancellation, and result rendering of human commands, owned by UI adapters and command plugins.
_Avoid_: command system, CLI layer

**Approval**:
A one-shot human authorization for a single execution.
_Avoid_: permission, consent, authorization

**Permission**:
A standing rule about a class of action for a session, as opposed to a one-shot approval.
_Avoid_: right, role, policy

**Permission preset**:
A named, reusable bundle of permissions selectable for a session.
_Avoid_: role, profile, template

### Turn output

**Deliverable**:
The concrete output a turn hands to the user: presented files and a changed-file summary.
_Avoid_: artifact, result, output, attachment

**Spill**:
Text a turn stores outside model context for later retrieval.
_Avoid_: note, saved output, attachment, memory

**Workspace**:
The shared filesystem domain a session operates in and sessions relate to.
_Avoid_: project, repository, folder