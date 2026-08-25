"""Seed the database with demo data for all three roles.

Run from ``backend/``:  ``python scripts/seed.py``

- Idempotent: if the admin demo user already exists the script is a no-op.
- Atomic: everything is committed in one transaction; a failure leaves nothing.
- No LLM calls: every insight is written directly with ``status=completed``,
  ``provider='seed'``, ``latency_ms=NULL`` so it never impersonates a real
  provider (Groq rate limits + speed).

Credentials are throwaway demo logins and are printed at the end of a run.
"""

from __future__ import annotations

import random
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

# Make ``app`` importable when run as a script from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    Customer,
    CustomerStatus,
    Insight,
    InsightStatus,
    Interaction,
    InteractionType,
    Role,
    Sentiment,
    User,
)

# --- Demo accounts (README-facing) -----------------------------------------
ADMIN_EMAIL = "admin@csp.demo"
PASSWORDS = {Role.admin: "Admin123!", Role.manager: "Manager123!", Role.csm: "Csm12345!"}
USERS = [
    ("admin@csp.demo", "Avery Admin", Role.admin),
    ("manager1@csp.demo", "Morgan Lee", Role.manager),
    ("manager2@csp.demo", "Priya Natarajan", Role.manager),
    ("csm1@csp.demo", "Sam Okafor", Role.csm),
    ("csm2@csp.demo", "Jules Moreau", Role.csm),
    ("csm3@csp.demo", "Dana Whitfield", Role.csm),
]

# (name, company, industry, status, health, arr) — owner assigned round-robin over CSMs
CUSTOMERS = [
    ("Elena Ruiz", "Northwind Logistics", "Logistics", CustomerStatus.active, 84, "120000.00"),
    ("Tom Becker", "Halcyon Health", "Healthcare", CustomerStatus.active, 78, "96000.00"),
    ("Ana Ferreira", "Brightline Retail", "Retail", CustomerStatus.at_risk, 41, "54000.00"),
    ("Kenji Sato", "Orbital Fintech", "Fintech", CustomerStatus.active, 91, "210000.00"),
    (
        "Lucía Gómez",
        "Cobalt Manufacturing",
        "Manufacturing",
        CustomerStatus.onboarding,
        55,
        "72000.00",
    ),
    ("Omar Haddad", "Summit EdTech", "Education", CustomerStatus.churned, 12, "18000.00"),
    ("Grace Chen", "Pinecrest Media", "Media", CustomerStatus.active, 73, "64000.00"),
    ("Ravi Menon", "Atlas Energy", "Energy", CustomerStatus.at_risk, 37, "150000.00"),
    ("Sofia Rossi", "Verdant Foods", "Food & Beverage", CustomerStatus.onboarding, 60, "45000.00"),
    ("Liam O'Brien", "Quartz SaaS", "Software", CustomerStatus.active, 88, "180000.00"),
    ("Maya Patel", "Harbor Insurance", "Insurance", CustomerStatus.at_risk, 33, "88000.00"),
    ("Noah Fischer", "Cinder Games", "Gaming", CustomerStatus.churned, 8, "22000.00"),
    ("Zara Ahmed", "Lumen Biotech", "Biotech", CustomerStatus.active, 69, "132000.00"),
    ("Ethan Park", "Redwood Realty", "Real Estate", CustomerStatus.onboarding, 50, "39000.00"),
    ("Isla Murray", "Tidal Telecom", "Telecom", CustomerStatus.active, 81, "240000.00"),
]

# Interaction/insight templates keyed by the sentiment they represent.
TEMPLATES: dict[Sentiment, list[tuple[InteractionType, str, str, str, list[str], list[str]]]] = {
    Sentiment.positive: [
        (
            InteractionType.qbr,
            "Quarterly business review",
            "Walked through Q usage metrics and adoption across three new teams. Champion is "
            "pleased with the reporting module and wants to expand seats next quarter.",
            "Strong QBR: adoption is up across new teams and the champion is planning a seat "
            "expansion next quarter.",
            ["Send seat expansion proposal", "Schedule enablement session for new teams"],
            [],
        ),
        (
            InteractionType.meeting,
            "Feature rollout check-in",
            "Reviewed the rollout of the new dashboard feature. Users adopted it quickly and the "
            "team asked about the roadmap for API access.",
            "Dashboard rollout landed well; the customer is now asking about API access.",
            ["Share API roadmap", "Book a technical deep-dive with their engineering lead"],
            [],
        ),
        (
            InteractionType.email,
            "Thank-you note after workshop",
            "Customer emailed to thank the team for last week's onboarding workshop and confirmed "
            "that the remaining departments will be trained internally.",
            "Positive follow-up after onboarding workshop; internal training is self-sufficient.",
            ["Send workshop recording and slides"],
            [],
        ),
    ],
    Sentiment.neutral: [
        (
            InteractionType.call,
            "Monthly sync call",
            "Routine monthly sync. No blockers reported; the customer asked for clarification on "
            "billing for additional users and how usage caps work.",
            "Routine sync with no blockers; billing and usage-cap questions raised.",
            ["Send billing FAQ", "Confirm usage cap thresholds with finance"],
            [],
        ),
        (
            InteractionType.support_ticket,
            "Report export formatting question",
            "Customer opened a ticket asking why CSV exports include timezone offsets. Explained "
            "the format and offered a workaround via the settings page.",
            "Support question about CSV export timezone formatting; workaround provided.",
            ["Follow up to confirm the workaround solved it"],
            [],
        ),
        (
            InteractionType.meeting,
            "Onboarding kickoff",
            "Kickoff meeting with the implementation team. Agreed on a six-week timeline, data "
            "migration owners, and a weekly check-in cadence.",
            "Onboarding kickoff complete with a six-week plan and weekly cadence agreed.",
            ["Share implementation plan", "Set up weekly check-in invites"],
            ["Data migration owner on customer side is part-time"],
        ),
    ],
    Sentiment.negative: [
        (
            InteractionType.support_ticket,
            "Escalation: sync failures",
            "Customer escalated repeated sync failures over the last two weeks that blocked their "
            "month-end close. They are frustrated with response times and mentioned evaluating "
            "alternatives.",
            "Serious escalation over recurring sync failures during month-end close; the customer "
            "is openly evaluating alternatives.",
            [
                "Engineering root-cause report within 48h",
                "Executive apology call",
                "Offer service credit",
            ],
            ["Churn risk: evaluating competitors", "Repeated outages during critical period"],
        ),
        (
            InteractionType.call,
            "Renewal concerns",
            "Champion said budget is under review and leadership questions the ROI. Usage has "
            "dropped since two power users left the company.",
            "Renewal at risk: budget scrutiny, weak ROI story, and usage decline after champion "
            "attrition.",
            ["Build ROI summary for leadership", "Identify and enable new power users"],
            ["Budget cut at renewal", "Loss of internal champions"],
        ),
        (
            InteractionType.email,
            "Complaint about missing feature",
            "Customer wrote that a promised integration has slipped twice and that their team is "
            "manually re-entering data as a result.",
            "Frustration over a twice-delayed integration causing manual double entry.",
            ["Get a firm delivery date from product", "Offer interim CSV import workaround"],
            ["Trust erosion from missed commitments"],
        ),
    ],
}

# Which sentiments an interaction tends to have, per customer status.
SENTIMENT_WEIGHTS: dict[CustomerStatus, list[tuple[Sentiment, int]]] = {
    CustomerStatus.active: [
        (Sentiment.positive, 6),
        (Sentiment.neutral, 3),
        (Sentiment.negative, 1),
    ],
    CustomerStatus.onboarding: [
        (Sentiment.positive, 3),
        (Sentiment.neutral, 6),
        (Sentiment.negative, 1),
    ],
    CustomerStatus.at_risk: [
        (Sentiment.positive, 1),
        (Sentiment.neutral, 3),
        (Sentiment.negative, 6),
    ],
    CustomerStatus.churned: [
        (Sentiment.positive, 0),
        (Sentiment.neutral, 3),
        (Sentiment.negative, 7),
    ],
}

TARGET_INTERACTIONS = 40


def _pick_sentiment(rng: random.Random, status: CustomerStatus) -> Sentiment:
    options, weights = zip(*SENTIMENT_WEIGHTS[status], strict=True)
    return rng.choices(options, weights=weights, k=1)[0]


def build(session: Session) -> tuple[int, int, int, int]:
    rng = random.Random(42)  # deterministic dataset
    now = datetime.now(UTC)

    users = [
        User(email=email, full_name=name, role=role, hashed_password=hash_password(PASSWORDS[role]))
        for email, name, role in USERS
    ]
    session.add_all(users)
    session.flush()  # ids for FKs

    managers = [u for u in users if u.role == Role.manager]
    csms = [u for u in users if u.role == Role.csm]

    customers: list[Customer] = []
    for i, (name, company, industry, status, health, arr) in enumerate(CUSTOMERS):
        owner = csms[i % len(csms)]
        slug = company.lower().replace(" ", "").replace("&", "and")
        customers.append(
            Customer(
                name=name,
                company=company,
                email=f"{name.split()[0].lower()}@{slug}.example.com",
                phone=f"+1-555-01{i:02d}",
                industry=industry,
                status=status,
                health_score=health,
                arr=Decimal(arr),
                owner=owner,
            )
        )
    session.add_all(customers)
    session.flush()

    interactions: list[Interaction] = []
    insights: list[Insight] = []
    for n in range(TARGET_INTERACTIONS):
        customer = customers[n % len(customers)]  # every customer gets ≥2, spread evenly
        sentiment = _pick_sentiment(rng, customer.status)
        itype, title, notes, summary, actions, risks = rng.choice(TEMPLATES[sentiment])
        # Mostly logged by the owner; sometimes a manager sat in.
        author = customer.owner if rng.random() < 0.8 else rng.choice(managers)
        occurred_at = now - timedelta(days=rng.randint(0, 89), hours=rng.randint(8, 18))
        interaction = Interaction(
            customer=customer,
            user=author,
            type=itype,
            title=f"{title} — {customer.company}",
            notes=notes,
            occurred_at=occurred_at,
            duration_minutes=rng.choice([15, 30, 45, 60])
            if itype != InteractionType.email
            else None,
        )
        interactions.append(interaction)
        insights.append(
            Insight(
                interaction=interaction,
                status=InsightStatus.completed,
                summary=summary,
                sentiment=sentiment,
                action_items=list(actions),
                risks=list(risks),
                raw_response=None,
                error_message=None,
                provider="seed",  # never impersonate a real LLM provider
                model=None,
                latency_ms=None,
                attempts=0,
            )
        )
    session.add_all(interactions)
    session.add_all(insights)
    return len(users), len(customers), len(interactions), len(insights)


def main() -> int:
    with SessionLocal() as session:
        if session.scalar(select(User.id).where(User.email == ADMIN_EMAIL)) is not None:
            print(f"Already seeded ({ADMIN_EMAIL} exists) — nothing to do.")
            return 0
        try:
            counts = build(session)
            session.commit()
        except IntegrityError as exc:
            # A concurrent/partial seed beat us to a unique key: roll back and skip.
            session.rollback()
            print(f"Seed skipped: unique constraint hit ({exc.orig}).")
            return 0

    n_users, n_customers, n_interactions, n_insights = counts
    print(
        f"Seeded {n_users} users, {n_customers} customers, "
        f"{n_interactions} interactions, {n_insights} insights."
    )
    print("\nDemo logins (throwaway):")
    for email, _name, role in USERS:
        print(f"  {role.value:<8} {email:<22} {PASSWORDS[role]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
