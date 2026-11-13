import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { components } from "../../shared/api/generated/nova-browser-api";
import { AccuracyAssessment } from "./AccuracyAssessment";

type Assessment = components["schemas"]["AccuracyAssessment"];
type Scope = components["schemas"]["AccuracyScope"];

const roc = [{ threshold: null, fpr: 0, tpr: 0 }, { threshold: 0.5, fpr: 0.1, tpr: 0.8 }, { threshold: null, fpr: 1, tpr: 1 }];
const pr = [{ threshold: 1, recall: 0, precision: null }, { threshold: 0.5, recall: 0.8, precision: 0.9 }, { threshold: 0, recall: 1, precision: 0.2 }];

function scope(overrides: Partial<Scope>): Scope {
  return {
    scope: "independent_optical", title: "Accuracy assessment against an independent Sentinel-2 optical reference",
    reference_basis: "Sentinel-2 optical flood reference; not field-verified", method: "census", n: 927,
    n_per_reference_class: { "0": 514, "1": 413 },
    confusion_matrix: {
      rows: "classified", columns: "reference",
      classified: {
        "1": { reference_1: 393, reference_0: 14, total: 407, users_accuracy: { fraction: "393/407", pct: 96.5602 } },
        "0": { reference_1: 20, reference_0: 500, total: 520, users_accuracy: { fraction: "500/520", pct: 96.1538 } },
      },
      reference_totals: { "1": 413, "0": 514, all: 927 },
      producers_accuracy: { "1": { fraction: "393/413", pct: 95.1574 }, "0": { fraction: "500/514", pct: 97.2763 } },
    },
    overall_accuracy_pct: 96.3323, cohens_kappa: 0.9256, f1_flooded: 0.9585, iou_flooded: 0.9204,
    per_class: [
      { class_label: "1", class_name: "Flood candidate", area_ha: 41.25, omission_error_pct: 4.8426, commission_error_pct: 3.4398, users_accuracy_pct: 96.5602, producers_accuracy_pct: 95.1574, f1_score: 0.9585 },
      { class_label: "0", class_name: "Not flood candidate", area_ha: 812.5, omission_error_pct: 2.7237, commission_error_pct: 3.8462, users_accuracy_pct: 96.1538, producers_accuracy_pct: 97.2763, f1_score: 0.9671 },
    ],
    roc, pr, prevalence: 0.4455, roc_auc: 0.9312, average_precision: 0.9123,
    roc_auc_note: "binary classifier; micro/macro ROC not applicable",
    confidence_intervals_95: null, interval_note: "census of all eligible pixels: no sampling error, so no sampling interval",
    ...overrides,
  };
}

const assessed: Assessment = {
  independent_status: "assessed", independent_reason: null,
  independent_wording: "Accuracy assessment against an independent Sentinel-2 optical reference: census of n = 927 eligible pixels not used for training. Not field-verified.",
  scopes: [
    scope({}),
    scope({ scope: "internal_screening", title: "Internal agreement with SAR screening labels — not independent flood-map accuracy (held-out pixels)",
      reference_basis: "SAR screening pseudo-label", method: "held_out_sample", n: 1500,
      confidence_intervals_95: { method: "percentile bootstrap, 1000 resamples, seed 2025", overall_accuracy_pct: [95.1, 97.4], cohens_kappa: [0.9, 0.95], roc_auc: [0.91, 0.95] },
      interval_note: "percentile bootstrap over the held-out sample" }),
  ],
};

describe("Accuracy assessment tables (2.2)", () => {
  it("shows the independent census first and internal agreement second, each with method and n", () => {
    render(<AccuracyAssessment assessment={assessed} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map(item => item.textContent);
    expect(headings[0]).toMatch(/independent Sentinel-2 optical reference/);
    expect(headings[1]).toMatch(/Internal agreement with SAR screening labels/);
    expect(screen.getByText(/Census of n = 927 eligible pixels/)).toBeInTheDocument();
    expect(screen.getByText(/Held-out sample, n = 1,500/)).toBeInTheDocument();
    expect(screen.getByText(assessed.independent_wording!)).toBeInTheDocument();
  });

  it("renders the 2x2 confusion matrix in the Makunga layout with UA and PA as fraction and percent", () => {
    render(<AccuracyAssessment assessment={{ ...assessed, scopes: [assessed.scopes[0]!] }} />);
    const table = screen.getByRole("table", { name: /Confusion matrix/ });
    const rows = within(table).getAllByRole("row");
    expect(within(table).getByRole("columnheader", { name: "Reference: new open water (optical)" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Reference: no new open water" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Classified: flood candidate" })).toBeInTheDocument();
    expect(within(table).getByText("393/407 (96.6%)")).toBeInTheDocument();
    expect(within(table).getByText("393/413 (95.2%)")).toBeInTheDocument();
    expect(within(table).getByText("500/514 (97.3%)")).toBeInTheDocument();
    expect(within(table).getByText("927")).toBeInTheDocument();
    expect(rows.length).toBe(5);
  });

  it("names the internal scope's columns after the SAR screening label", () => {
    render(<AccuracyAssessment assessment={{ ...assessed, scopes: [assessed.scopes[1]!] }} />);
    const table = screen.getByRole("table", { name: /Confusion matrix/ });
    expect(within(table).getByRole("columnheader", { name: "SAR screening label: flood candidate" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "SAR screening label: not flood candidate" })).toBeInTheDocument();
  });

  it("renders the per-class summary (Table 8) with area, omission, commission, UA, PA, F1, OA and Kappa", () => {
    render(<AccuracyAssessment assessment={{ ...assessed, scopes: [assessed.scopes[0]!] }} />);
    const table = screen.getByRole("table", { name: /Per-class accuracy summary/ });
    for (const header of ["Class", "Area (ha)", "Omission error (%)", "Commission error (%)", "User's accuracy (%)", "Producer's accuracy (%)", "F1"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(within(table).getByText("41.25")).toBeInTheDocument();
    expect(within(table).getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText(/Overall accuracy 96\.3% · Kappa 0\.926 · F1 \(flood candidate\) 0\.959 · IoU 0\.920/)).toBeInTheDocument();
  });

  it("draws ROC with the 1:1 diagonal and PR with the prevalence baseline, annotated with AUC, AP and n", () => {
    render(<AccuracyAssessment assessment={{ ...assessed, scopes: [assessed.scopes[0]!] }} />);
    const rocFigure = screen.getByRole("img", { name: /ROC curve/ });
    expect(rocFigure.querySelector("[data-testid=diagonal]")).not.toBeNull();
    expect(rocFigure.querySelector("polyline")?.getAttribute("points")?.split(" ").length).toBe(3);
    expect(screen.getByText(/AUC 0\.931 · positives 413 · negatives 514/)).toBeInTheDocument();
    const prFigure = screen.getByRole("img", { name: /Precision-recall curve/ });
    expect(prFigure.querySelector("[data-testid=prevalence]")).not.toBeNull();
    expect(prFigure.querySelector("polyline")?.getAttribute("points")?.split(" ").length).toBe(2);
    expect(screen.getByText(/AP 0\.912 · prevalence 0\.446/)).toBeInTheDocument();
    expect(screen.getByText("binary classifier; micro/macro ROC not applicable")).toBeInTheDocument();
  });

  it("shows bootstrap intervals only for the held-out sample and the census note otherwise", () => {
    render(<AccuracyAssessment assessment={assessed} />);
    expect(screen.getByText(/95% interval: OA 95\.1–97\.4% · Kappa 0\.900–0\.950 · AUC 0\.910–0\.950/)).toBeInTheDocument();
    expect(screen.getByText(/no sampling error, so no sampling interval/)).toBeInTheDocument();
  });

  it("states why independent accuracy is missing and still shows internal agreement", () => {
    render(<AccuracyAssessment assessment={{ independent_status: "not_assessable", independent_reason: "Sentinel-2 baseline: No compliant optical scene in the requested window", independent_wording: null, scopes: [assessed.scopes[1]!] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Independent accuracy: not assessable. Sentinel-2 baseline: No compliant optical scene in the requested window");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });

  it("renders missing values as an em dash instead of NaN", () => {
    const empty = scope({ roc_auc: null, average_precision: null, cohens_kappa: null, per_class: [{ ...assessed.scopes[0]!.per_class[0]!, users_accuracy_pct: null }] });
    render(<AccuracyAssessment assessment={{ ...assessed, scopes: [empty] }} />);
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
    expect(screen.getByText(/AUC — ·/)).toBeInTheDocument();
  });
});
