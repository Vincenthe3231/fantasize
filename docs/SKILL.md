---
name: virtual-production-scout
description: >
  Define, build, and reason about node-based AI creative pipelines modelled on the
  Virtual Production Scout workflow — a multi-stage canvas system where location
  photos, prop references, and placement briefs are chained through AI generation,
  camera variation, lighting simulation, and atmosphere grading to produce a complete
  pre-visualisation package without physical production. Use this skill whenever a
  user wants to design, implement, extend, or debug a node-canvas workflow involving
  any combination of: location scouting, set dressing, camera coverage, lighting
  scenario testing, atmosphere grading, batch generation, or multi-stage AI pipelines.
  Also trigger for questions about node connection logic, data propagation between
  stages, group panel behaviour, human gate placement, or List-node batch multiplier
  patterns.
---

# Virtual Production Scout — Pipeline Skill

A business-logic reference for designing and implementing the Virtual Production
Scout node-canvas pipeline. Covers the full five-stage workflow from raw location
input to final atmosphere selection, including all inter-node data contracts,
propagation rules, human decision gates, and batch generation policies.

---

## CONTEXT

### What This Pipeline Does

The Virtual Production Scout is a repeatable, node-based creative pipeline that
transforms three raw inputs — empty location photographs, prop reference images,
and a written furniture placement brief — into a fully pre-visualised production
package. The package includes a dressed room composite, multi-angle camera coverage,
lighting condition variants, and graded atmosphere options, all generated without
physical construction or on-set photography.

The pipeline is organised into five sequential group stages. Each stage is a
self-contained logical unit with defined inputs, a defined process, and defined
outputs. Stages communicate exclusively through typed data connections. No stage
can begin processing until all required upstream inputs are present and valid.

### The Five Stages

**Stage 1 — Location Input**
Collects all raw human-supplied references. No AI processing occurs here. The
stage is purely an ingestion and labelling layer. It contains three parallel
input nodes operating independently:

- The Location node accepts multiple photographs of the empty physical space.
  Each photograph is an individual output, not a merged batch, because downstream
  processes need to compare angles independently.
- The Placement node accepts a structured written breakdown of furniture positions,
  architectural features, and lighting notes. This is the spatial contract that
  governs all downstream generation.
- The Props node accepts one reference image per named prop. Each prop image is
  an individually labelled output so the AI can associate visual style with a
  specific object name.

All outputs from this stage flow into Stage 2.

**Stage 2 — Set Dressing Preview**
Synthesises all Stage 1 inputs into a single photorealistic dressed-room image.
This stage contains two sequential sub-nodes:

- The Instructions sub-node is an LLM node that receives every upstream input
  simultaneously — all location photos, all prop images, and the placement text.
  Its sole job is to produce a single, precise natural-language generation prompt
  that encodes spatial layout, prop placement, material style, and lighting intent.
  It does not generate images; it generates instructions.
- The Preview sub-node is an image generator that receives the constructed prompt
  plus one location photo as a structural anchor. It outputs a single composite
  image. This is the first AI-generated artefact in the pipeline.

This stage contains the primary human trigger gate. The pipeline does not run
automatically. A human must explicitly initiate execution after reviewing the
constructed prompt.

**Stage 3 — Camera Coverage**
Takes the single dressed-room image and produces a curated camera angle for all
downstream work. The stage contains three sequential sub-nodes:

- The Angle Variations sub-node generates multiple simultaneous reframes of the
  same scene, producing a grid of camera perspectives in a single generation run.
- The Variations List sub-node accumulates all generated angles into a browsable
  collection. Multiple generation runs may feed into the same list, building a
  larger selection pool over time.
- The Selected Shot sub-node holds exactly one image — the human-chosen hero angle.
  This is the second human decision gate. No downstream stage receives input until
  a selection is made here.

**Stage 4 — Lighting Scenario**
Applies a list of lighting conditions to the selected camera angle in a single
batch run. The stage contains three sequential sub-nodes:

- The Lighting List sub-node holds multiple named lighting conditions as
  individual text strings. Each string is a separate output wire, not a combined
  prompt. The number of strings determines the number of parallel generations.
- The Lighting Results sub-node receives the selected shot image plus all lighting
  strings simultaneously. It runs one generation per lighting string in parallel,
  producing a matched set of variants that differ only in lighting treatment.
- The Lighting Variations List sub-node accumulates all lighting results into a
  browsable collection. Its single output wire carries the full image set forward.

**Stage 5 — Atmosphere Test**
Tests emotional grading and colour tone against the confirmed lighting set. This
stage runs two independent sub-pipelines in parallel, producing comparable outputs
from two different input methods:

- The Text sub-pipeline takes a written mood and colour tone description, runs it
  as a batch against the lighting variants, and produces a set of colour-graded
  results.
- The Reference sub-pipeline takes a single uploaded reference image (such as a
  film still) that represents a desired look, runs it as a visual style reference
  against the same lighting variants, and produces a parallel set of results.

Both sub-pipelines produce separate output lists. The human compares them and
selects a direction. This is the third and final human decision gate. The pipeline
ends here; no further automated stages follow.

---

## TASK

### Step-by-Step Pipeline Execution

**Step 1: Populate Location Input (Stage 1)**
The operator uploads location photographs to the Location node — one slot per
photograph, each independently labelled. The operator uploads one reference image
per prop to the Props node — each cell carries the prop name as its label. The
operator writes the placement breakdown in the Placement node as a structured
list. No step in Stage 1 depends on any other; all three nodes are populated
independently and in any order.

**Step 2: Validate Stage 1 completeness**
Before Stage 2 can run, all three Stage 1 nodes must have at least one value.
The Location node requires at least one photograph. The Props node requires at
least one labelled prop image. The Placement node requires non-empty text. If any
of these conditions is unmet, the pipeline cannot proceed and the trigger gate
in Stage 2 remains locked.

**Step 3: Construct the generation prompt (Stage 2, Instructions sub-node)**
When the operator initiates the pipeline, the Instructions sub-node receives all
Stage 1 outputs as simultaneous inputs. It processes them together and emits a
single natural-language prompt. The prompt must encode: the spatial layout from
the placement text, the visual appearance of each named prop from its reference
image, and the architectural character of the space from the location photographs.
This node does not output an image.

**Step 4: Generate the dressed-room composite (Stage 2, Preview sub-node)**
The Preview sub-node receives the constructed prompt from Step 3 and one location
photograph as a structural reference. It generates one image. This image becomes
the canonical base for all subsequent stages. If the result is unsatisfactory,
the operator may modify Stage 1 inputs or the constructed prompt and re-trigger.
No downstream stage runs until this image is accepted.

**Step 5: Generate camera angle variations (Stage 3, Angle Variations sub-node)**
The dressed-room image from Step 4 flows into the Angle Variations sub-node,
which generates a grid of simultaneous camera reframes. All reframes are derived
from the same source image; no new scene composition occurs at this step. The
number of generated angles is determined by the configured grid size.

**Step 6: Accumulate and browse angle options (Stage 3, Variations List sub-node)**
All generated angles flow into the Variations List, which functions as an
accumulating library. The operator may run Step 5 multiple times; each run adds
to the same list rather than replacing it. The operator browses the accumulated
collection before making a selection.

**Step 7: Select the hero angle (Stage 3, Selected Shot sub-node)**
The operator selects exactly one image from the Variations List and assigns it
to the Selected Shot sub-node. This is the second human gate. The selected image
becomes the sole input to Stage 4. Until a selection is committed, Stage 4
receives no input and cannot run.

**Step 8: Define lighting conditions (Stage 4, Lighting List sub-node)**
The operator reviews the pre-populated lighting conditions list and modifies it
to match production requirements — adding, editing, or removing conditions. Each
list item is a discrete text string. The count of items directly determines the
number of images Stage 4 will generate.

**Step 9: Run batch lighting generation (Stage 4, Lighting Results sub-node)**
The Lighting Results sub-node receives the selected shot image once and all
lighting strings simultaneously. It runs one generation per string in parallel.
A pipeline with six lighting conditions produces exactly six output images.
Each output image shares the same camera angle and scene composition as the
selected shot, differing only in lighting treatment.

**Step 10: Accumulate lighting results (Stage 4, Lighting Variations List)**
All lighting results flow into the Lighting Variations List. The full set of
lighting variants becomes a single output that flows forward to Stage 5. The
operator may inspect the results here before proceeding.

**Step 11: Run parallel atmosphere tests (Stage 5)**
Stage 5 runs two sub-pipelines simultaneously. The Text sub-pipeline takes a
written mood and colour description, constructs a grading instruction, and runs
it as a batch against the incoming lighting variants. The Reference sub-pipeline
takes an uploaded look-reference image and applies its colour and tonal character
as a style transfer instruction against the same lighting variants. Both
sub-pipelines execute independently and do not share intermediate state.

**Step 12: Compare and select atmosphere direction (Stage 5, final gate)**
Both atmosphere output lists are presented side by side. The operator compares
the text-driven results against the reference-driven results and selects a
direction. This selection is the final output of the pipeline. The selected
atmosphere direction, combined with its parent camera angle, lighting condition,
and dressed-room composite, constitutes the complete pre-visualisation deliverable.

---

## RULES

### Data Flow Constraints

- Data flows in one direction only: from left to right across stages. No node
  may receive input from a node at the same stage or a downstream stage.
- A node may not begin processing until all of its required input handles carry
  a value. Optional input handles may be empty without blocking execution.
- A single output handle may connect to multiple downstream input handles
  simultaneously. The same value is delivered to every connected target without
  modification.
- A single input handle may receive only one connection. If a second connection
  is attempted to an occupied input handle, the attempt is rejected.
- Each prop image in the Props node is its own labelled output. Prop images are
  not merged into a single multi-image output. Each wire carries one prop's
  image and its associated label.

### Human Gate Rules

- Stage 2 has a mandatory human trigger gate. The pipeline does not execute
  automatically on Stage 1 completion. A human must initiate execution.
- Stage 3 has a mandatory human selection gate at the Selected Shot sub-node.
  Downstream stages receive no data until exactly one image is assigned to this
  node.
- Stage 5 has a mandatory human selection gate at the final atmosphere comparison.
  No automated action follows this gate; selection is the terminal act.
- No gate may be bypassed or pre-populated by an automated process.

### Batch Generation Rules

- The Lighting List sub-node defines batch size. If the list contains N items,
  Stage 4 produces exactly N output images per run. Adding or removing items
  before running changes the output count accordingly.
- The Atmosphere Test sub-pipelines inherit batch size from Stage 4. If Stage 4
  produced six lighting variants, each atmosphere sub-pipeline also produces six
  outputs, one per incoming variant.
- Batch generation runs all items in parallel. Sequential execution within a
  batch is not permitted.
- Running a batch again does not replace previous results in a List node. Results
  accumulate. To start fresh, the list must be explicitly cleared.

### Re-run and Override Rules

- Any stage may be re-run independently if its inputs are modified, provided all
  upstream inputs remain valid. Re-running a stage does not automatically
  re-run downstream stages.
- If a Stage 1 input is changed after Stage 2 has already produced output, the
  Stage 2 output is considered stale. The operator must re-run Stage 2 manually.
  Stale status does not propagate automatically; the operator is responsible for
  identifying and re-running affected stages.
- The Selected Shot in Stage 3 may be replaced at any time. Replacing the
  selected shot marks all Stage 4 and Stage 5 outputs as stale.
- A prop image in Stage 1 may be replaced without replacing the other prop images.
  Replacing one prop marks the Stage 2 output as stale but does not affect other
  Stage 1 nodes.
- The Placement text may be edited at any time. Any edit marks the Stage 2 output
  as stale.

### Completeness Rules

- Stage 2 may not run if the Location node has no photographs, the Props node has
  no images, or the Placement node has no text.
- Stage 3 may not run if Stage 2 has not produced a valid output image.
- Stage 4 may not run if the Selected Shot sub-node in Stage 3 is empty, or if
  the Lighting List contains zero items.
- Stage 5 may not run if Stage 4 has produced no output images. The Text
  sub-pipeline requires at least one mood descriptor. The Reference sub-pipeline
  requires at least one uploaded look-reference image. Each sub-pipeline may run
  independently if its own inputs are satisfied.

### LLM Prompt Construction Rules

- The Instructions sub-node in Stage 2 must receive all location images, all prop
  images, and the full placement text before constructing the generation prompt.
  Partial input sets produce incomplete prompts and should be rejected.
- The constructed prompt is the authoritative instruction for the Preview
  sub-node. The Preview sub-node does not interpret raw Stage 1 inputs directly;
  it operates exclusively from the constructed prompt plus one structural image.
- The structural image reference passed to the Preview sub-node must be one of
  the location photographs, not a prop image. Prop images define object style;
  location images define spatial structure.

### Annotation Node Rules

- Annotation nodes carry instructional text for operators. They are not connected
  to any data flow and do not receive or emit values.
- Annotation content is stage-contextual guidance and does not affect pipeline
  execution under any condition.
- Annotations may not be used to pass data between nodes by any mechanism.

### Naming and Labelling Rules

- Every prop image must carry a human-readable label identifying the object it
  depicts. Unlabelled prop images may not be connected to the Instructions
  sub-node.
- Every lighting condition in the Lighting List must be a non-empty text string.
  Empty strings may not be included in a batch run.
- Stage and group labels are informational identifiers. They do not affect
  execution order or data routing.