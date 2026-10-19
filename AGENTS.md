# Codex instructions

Optimize for low token usage and minimal changes.

- Be concise.
- Search before reading files.
- Read only files relevant to the task.
- Do not scan the whole repository unless necessary.
- Do not reread unchanged files.
- Make the smallest correct change.
- Do not refactor unrelated code.
- Do not explain routine actions.
- Run only targeted tests/checks for changed code.
- Do not repeat tests unless needed after a fix.
- Avoid subagents unless they clearly reduce work.
- Stop when the requested task is complete.

## Task handling

Assume short task prompts are intentional.

When a task is clear:

- Do not ask for extra details unless required to proceed safely or correctly.
- Infer the smallest reasonable scope from the request.
- Apply all instructions in this file automatically.
- Do not restate these instructions or repeat the user's prompt.
- Do not create a plan for trivial changes.

For each task:

1. Understand the requested outcome.
2. Locate the smallest relevant code area.
3. Make a short plan only if the task is non-trivial.
4. Implement the minimum necessary change.
5. Run targeted verification.
6. Fix failures caused by the change.
7. Briefly summarize what changed and stop.

Prefer:

search → inspect → edit → verify → stop

Do not perform speculative improvements, broad cleanup, architecture reviews, or unrelated investigation unless explicitly requested.

## Project Configuration

- **Language**: JavaScript (JSDoc)
- **Package Manager**: pnpm
- **Add-ons**: prettier, eslint, tailwindcss, sveltekit-adapter, ai-tools

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
