"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { catalog } from "@/lib/catalog";
import { infoFor } from "@/lib/shop";
import ProductCard from "./ProductCard";
import Icon from "./Icon";
const questions = [
  {
    title: "Who are we thinking of?",
    label: "The person",
    key: "person",
    choices: [
      "A partner",
      "Family",
      "A friend",
      "A colleague or team",
      "A pet person",
      "A group of guests",
    ],
  },
  {
    title: "What is the occasion?",
    label: "The moment",
    key: "occasion",
    choices: [
      "Birthday",
      "Wedding",
      "Anniversary",
      "Housewarming",
      "Graduation",
      "Remembrance",
      "Thank you",
      "Retirement",
      "Holiday",
    ],
  },
  {
    title: "What feels most like them?",
    label: "The feeling",
    key: "style",
    choices: [
      "Useful, every day",
      "At home, with good company",
      "A memory to keep close",
      "A small, thoughtful token",
      "Something for the whole team",
      "Help me explore",
    ],
  },
];
export default function GiftFinder() {
  const [step, setStep] = useState(0),
    [answers, setAnswers] = useState<Record<string, string>>({
      person: "A partner",
      occasion: "Birthday",
      style: "Useful, every day",
    }),
    [finished, setFinished] = useState(false);
  const question = questions[step];
  const recommendations = useMemo(() => {
    const preferred: Record<string, string[]> = {
      "Useful, every day": ["drinkware", "small-gifts"],
      "At home, with good company": ["kitchen", "glassware-bar"],
      "A memory to keep close": ["photo-crystals", "ornaments", "jewelry-pets"],
      "A small, thoughtful token": ["small-gifts", "ornaments", "jewelry-pets"],
      "Something for the whole team": ["drinkware", "small-gifts"],
      "Help me explore": [],
    };
    return catalog.products
      .filter((p) => p.slug !== "crystal-bases")
      .map((p, index) => ({
        p,
        index,
        score:
          (infoFor(p).occasions.includes(answers.occasion) ? 4 : 0) +
          (preferred[answers.style]?.includes(p.category) ? 3 : 0) +
          (answers.person === "A pet person" &&
          (p.category === "jewelry-pets" || p.slug === "photo-crystal-dog-bone")
            ? 4
            : 0) +
          (answers.person === "A group of guests" &&
          ["small-gifts", "ornaments"].includes(p.category)
            ? 3
            : 0),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 3)
      .map((r) => r.p);
  }, [answers]);
  return (
    <div className="finder">
      <div className="finder-panel">
        <div className="finder-heading">
          <div>
            <p className="eyebrow">A thoughtful starting point</p>
            <h2>
              {finished ? "A few gifts that feel like them." : question.title}
            </h2>
          </div>
          <Icon name="sparkle" size={34} />
        </div>
        <div
          className="finder-steps"
          role="group"
          aria-label={"Step " + (finished ? 3 : step + 1) + " of 3"}
        >
          {questions.map((q, i) => (
            <span
              key={q.key}
              className={finished || i <= step ? "active" : ""}
            />
          ))}
        </div>
        {finished ? (
          <>
            <p className="muted small">
              For {answers.person.toLowerCase()} · {answers.occasion} ·{" "}
              {answers.style}
            </p>
            <div className="finder-nav">
              <button
                className="link-button"
                onClick={() => {
                  setStep(0);
                  setFinished(false);
                }}
              >
                Change your answers
              </button>
              <Link className="text-link" href="/custom-orders">
                Have something else in mind? <Icon name="arrow" size={16} />
              </Link>
            </div>
          </>
        ) : (
          <>
            <div
              className="finder-options"
              role="group"
              aria-label={question.label}
            >
              {question.choices.map((c) => (
                <button
                  className={
                    "choice-button" +
                    (answers[question.key] === c ? " selected" : "")
                  }
                  aria-pressed={answers[question.key] === c}
                  key={c}
                  onClick={() =>
                    setAnswers((a) => ({ ...a, [question.key]: c }))
                  }
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="finder-nav">
              <button
                className="link-button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={!step}
              >
                Back
              </button>
              <span className="small muted">{step + 1} / 3</span>
              <button
                className="button primary"
                onClick={() =>
                  step === 2 ? setFinished(true) : setStep((s) => s + 1)
                }
              >
                {step === 2 ? "Find their gifts" : "Next little detail"}
                <Icon name="arrow" size={17} />
              </button>
            </div>
          </>
        )}
        <p className="finder-note">
          Suggestions come from our collection and your choices. Pricing,
          availability, and engraving details are reviewed separately. No chat
          or AI service is required.
        </p>
      </div>
      {finished && (
        <>
          <div className="finder-result-heading">
            <div>
              <p className="eyebrow">Selected with your answers in mind</p>
              <h2>A little inspiration.</h2>
            </div>
            <Link
              href={"/shop?occasion=" + encodeURIComponent(answers.occasion)}
              className="text-link"
            >
              Keep exploring <Icon name="arrow" size={17} />
            </Link>
          </div>
          <div className="product-grid">
            {recommendations.map((p) => (
              <ProductCard product={p} key={p.slug} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
