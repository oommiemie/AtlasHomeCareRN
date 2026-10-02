# Assistant evaluation

Asks the assistant real questions against the hospital's model
(`AI_HOST` in `src/models/aiHost.ts`) using the app's own sample data, and
checks each answer against what that data says — the right person, the right
figures, a refusal where one is due.

```sh
scripts/assistant-eval/run.sh          # every set
scripts/assistant-eval/run.sh main     # one: main | held | skills | wide | en | coverage | voice
```

| Set | What it covers |
|---|---|
| `main` | counts, allergies, medicines, readings, actions, ambiguous and unknown names; also flags any number in an answer that is not in its sources |
| `held` | new wordings and follow-up questions ("แล้วคุณบุญเรือนล่ะ") |
| `skills` | visit preparation, comparisons, household, assessments, notes, allergy check, supplies, handover, app search |
| `wide` | colloquial Thai and typos, out-of-scope questions, diagnosis and dose refusals, an instruction hidden in a note, voice mode (streamed) |
| `en` | the same in English |
| `coverage` | every topic once — round, places, health, record, medicines, history, follow-up, activities, brief, actions, context, speech-recognition slips, safety, scope — and the ones a carer asks aloud again by voice, judged as speech: what `sayable` would say, its length, no "below", no list, and how soon the first words arrive |
| `voice` | only the spoken half of `coverage` |

Answers vary from run to run; run a set twice before believing a change.
When an answer is wrong, add it as a case first, then fix the prompt, tool or
check that let it through, and keep the case — that is how the assistant
gets better without losing what it already does.

`build.sh` bundles `src/models/assistant.ts` for Node with stand-ins for the
phone-only modules (`.out/`, ignored).
