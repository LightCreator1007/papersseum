# Learn: the course content

This folder holds the free course "Learn RL from zero" that appears on the website at `/learn`. It is plain text and Python, so you can fix a typo or write a chapter without touching the website code.

```
resources/
  course.json                    the outline: parts, chapters, titles, summaries, status
  chapters/
    03-bandits/
      index.mdx                  the lesson (Markdown + LaTeX equations + a few tags)
      code/
        bandit_basics.py         runnable example for the lesson
        check_numbers.py         checks every number quoted in the lesson
  glossary.mdx                   reference pages (optional, listed in course.json)
  cheatsheet.mdx
```

`web/scripts/sync-learn.mjs` turns this into what the site builds from. It runs before `npm run dev` and `npm run build`, and it fails the build on a broken lesson.

## Adding or finishing a chapter

1. Find the chapter in `course.json`. It starts as `"status": "planned"`.
2. Write `chapters/<slug>/index.mdx` and its `code/` files.
3. Change the status to `"ready"`.
4. Check it: `pytest tests/test_resources.py` and, from `web/`, `npm run sync:learn`.
5. Open a pull request. A person reads every chapter before it merges.

Planned chapters appear on the course map as "soon". Never link to a chapter that is not ready; the check rejects it. The previous and next buttons are added automatically.

## Writing the lesson (the style guide)

The whole point is that a beginner enjoys reading it. Write like a patient senior student at a whiteboard.

- **Talk to one person.** "You" and "we". Short sentences, short paragraphs, one idea at a time.
- **Start from something real.** Open with a puzzle, a story or a small game. Cricket, chai, exams, choosing where to eat: everyday decisions are RL problems in disguise.
- **Intuition first, then symbols.** Say it in plain words, show a tiny numeric example, and only then write the formula. Read the formula aloud in words right after it.
- **Never use a word you have not explained.** Define each new term in a sentence the first time it appears.
- **Normalise being confused.** Say when something is tricky. Show the common mistakes.
- **Maths stops at JEE Mains.** Anything beyond (gradients of several variables, for example) is explained through something JEE covers. Introduce every symbol in a sentence before using it in an equation.
- **Be honest.** Say what an idea is bad at and what you simplified or left out.
- **Never mention dates, seasons or the current competition.** The course stays open forever. The only place it talks about Papersseum is the bridge chapter, and even there it describes the game, not an event.
- **No author names.** The Papersseum team speaks.
- Plain English, UK or US spelling, but be consistent.

### Chapter skeleton

Every chapter follows the same shape, so readers always know where they are:

1. An "At a glance" callout: time, what you will learn, what you need.
2. A hook: a puzzle, story or game (a demo if one fits).
3. The idea in plain words.
4. The maths, step by step, with a worked numeric example before the general formula.
5. Code: a short runnable script.
6. A demo, when it helps.
7. `## Check yourself`: three to five questions, each in a `<Check>` block.
8. `## Recap`: five lines.
9. `## Where next`: a sentence or two.

`## Check yourself` and `## Recap` are required; the build fails without them. Do not write a `# Title`: the page title comes from `course.json`. Do not put equations in headings.

### Tags you can use in a lesson

````mdx
<Callout title="At a glance">Text with **bold**. Add kind="maths", "careful" or "try" for other colours.</Callout>

<Check q="A question?">The answer, hidden until the reader opens it. Equations like $x^2$ work here too.</Check>

<BanditCasino />   {/* an interactive demo; see web/features/learn/components/ */}
````

Equations are LaTeX: `$x^2$` inline and `$$ ... $$` on their own lines. They are checked at build time, and a mistake fails the build.

Code blocks are fenced with a language (```python). Tables use ordinary Markdown pipes.

## Code in a chapter

- `check_numbers.py` is required for every ready chapter. It asserts every number the lesson quotes (worked examples, table values, claims like "about 95%"), so the text and the maths cannot drift apart. Keep tolerances honest: use exact checks for exact maths and a small tolerance for simulated results.
- Other scripts must accept `--fast`, finish in seconds, and check themselves with `assert` in that mode.
- Seed every random generator, so results are reproducible.
- Use NumPy only unless the chapter really needs more. If a script needs another library, put `# requires: torch` in its first lines and it is skipped when the library is missing.
- Files starting with `_` are helpers and are not run or published.

CI runs all of this (`tests/test_resources.py`).

## Interactive demos

Demos are React components in `web/features/learn/components/`, with their logic in plain, tested TypeScript in `web/features/learn/`. Register the component in `web/mdx-components.tsx` so lessons can use it as a tag. Seed any randomness so the first render is the same on the server and in the browser; call `Math.random()` only inside event handlers.
