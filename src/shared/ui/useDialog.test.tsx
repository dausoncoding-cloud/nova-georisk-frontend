import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { useDialog } from "./useDialog";
function Example() {
  const [open, setOpen] = useState(false);
  const ref = useDialog(open, () => setOpen(false));
  return <><button onClick={() => setOpen(true)}>Open</button>{open ? <section ref={ref} role="dialog" aria-modal="true"><button>First</button><button>Last</button></section> : null}</>;
}
it("contains focus, dismisses with Escape and restores the trigger", () => {
  render(<Example />);
  const trigger = screen.getByText("Open"); trigger.focus(); fireEvent.click(trigger);
  expect(screen.getByText("First")).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(screen.getByText("Last")).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(screen.getByText("First")).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
