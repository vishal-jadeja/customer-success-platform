"""System + user prompt templates for insight generation."""

from __future__ import annotations

NOTES_MAX_CHARS = 8000

SYSTEM_PROMPT = """You are a customer success analyst. You are given the notes from one \
customer interaction (a meeting, call, email, or support ticket). Produce a structured \
insight from those notes.

Respond with ONLY a single JSON object — no markdown fences, no commentary — matching \
exactly this schema:
{
  "summary": "2-4 sentence summary of the interaction",
  "sentiment": "positive" | "neutral" | "negative",
  "action_items": ["short action item", ...],
  "risks": ["short risk or concern", ...]
}
"action_items" and "risks" may be empty arrays if none apply. Use only these four fields."""

REPAIR_INSTRUCTION = """Your previous response was not valid JSON matching the required \
schema. Return ONLY valid JSON matching this schema, nothing else — no markdown fences, \
no commentary:
{{"summary": "string", "sentiment": "positive|neutral|negative", "action_items": ["string"], \
"risks": ["string"]}}

Your previous response was:
{broken}"""


def build_user_prompt(*, notes: str, customer_name: str, customer_status: str) -> str:
    truncated = notes[:NOTES_MAX_CHARS]
    return (
        f"Customer: {customer_name} (status: {customer_status})\n\n"
        f"Interaction notes:\n{truncated}"
    )
