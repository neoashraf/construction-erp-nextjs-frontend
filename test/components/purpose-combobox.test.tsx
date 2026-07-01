/**
 * FE-7 PurposeCombobox tests (FR-MAS-012/013).
 * Typeahead, "Create '<typed>'" option, idempotent select, keyboard nav, offline.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { type Purpose } from "@/features/master-data/types";
import { PurposeCombobox } from "@/features/master-data/components/PurposeCombobox";
import * as api from "@/features/master-data/api/purposes";

jest.mock("@/features/master-data/api/purposes", () => ({
  listPurposes: jest.fn(),
  createPurpose: jest.fn(),
  renamePurpose: jest.fn(),
  deactivatePurpose: jest.fn(),
  reactivatePurpose: jest.fn(),
}));

const listMock = api.listPurposes as jest.Mock;
const createMock = api.createPurpose as jest.Mock;

const FOUNDATION: Purpose = {
  id: "p1",
  projectId: "proj1",
  name: "Foundation",
  isActive: true,
  version: 1,
};

function pageOf(...ps: Purpose[]) {
  return { data: ps, page: 1, pageSize: 100, total: ps.length };
}

function renderCombobox(props: Partial<React.ComponentProps<typeof PurposeCombobox>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onChange = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <PurposeCombobox projectId="proj1" value={null} onChange={onChange} {...props} />
    </QueryClientProvider>,
  );
  return { onChange };
}

beforeEach(() => {
  listMock.mockReset();
  createMock.mockReset();
});

it("has combobox semantics and opens a listbox on focus (a11y §10)", async () => {
  listMock.mockResolvedValue(pageOf(FOUNDATION));
  renderCombobox();
  const input = screen.getByTestId("purpose-combobox-input");
  expect(input).toHaveAttribute("role", "combobox");
  await userEvent.click(input);
  expect(input).toHaveAttribute("aria-expanded", "true");
  expect(await screen.findByRole("listbox")).toBeInTheDocument();
  expect(await screen.findByTestId("purpose-option-p1")).toBeInTheDocument();
});

it("selects an existing purpose (FR-MAS-012)", async () => {
  listMock.mockResolvedValue(pageOf(FOUNDATION));
  const { onChange } = renderCombobox();
  await userEvent.click(screen.getByTestId("purpose-combobox-input"));
  await userEvent.click(await screen.findByTestId("purpose-option-p1"));
  expect(onChange).toHaveBeenCalledWith(FOUNDATION);
});

it("shows 'Create' only when the typed text matches nothing (FR-MAS-012)", async () => {
  listMock.mockResolvedValue(pageOf(FOUNDATION));
  renderCombobox();
  const input = screen.getByTestId("purpose-combobox-input");
  await userEvent.type(input, "Roofing");
  expect(await screen.findByTestId("purpose-create-option")).toHaveTextContent("Create ‘Roofing’");
});

it("does NOT show Create when the text exactly matches (case-insensitive)", async () => {
  listMock.mockResolvedValue(pageOf(FOUNDATION));
  renderCombobox();
  await userEvent.type(screen.getByTestId("purpose-combobox-input"), "foundation");
  await screen.findByTestId("purpose-option-p1");
  expect(screen.queryByTestId("purpose-create-option")).not.toBeInTheDocument();
});

it("Create is idempotent — an existing name returns the existing purpose (edge §12.5)", async () => {
  listMock.mockResolvedValue(pageOf());
  createMock.mockResolvedValue(FOUNDATION); // server returns existing (200)
  const { onChange } = renderCombobox();
  await userEvent.type(screen.getByTestId("purpose-combobox-input"), "Foundation");
  await userEvent.click(await screen.findByTestId("purpose-create-option"));
  await waitFor(() => expect(createMock).toHaveBeenCalledWith("proj1", "Foundation"));
  expect(onChange).toHaveBeenCalledWith(FOUNDATION);
});

it("keyboard: ArrowDown highlights, Enter selects (a11y §10)", async () => {
  listMock.mockResolvedValue(pageOf(FOUNDATION));
  const { onChange } = renderCombobox();
  const input = screen.getByTestId("purpose-combobox-input");
  await userEvent.click(input);
  await screen.findByTestId("purpose-option-p1");
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(FOUNDATION));
});

it("offline: create failure shows 'Can't create a purpose while offline.'", async () => {
  listMock.mockResolvedValue(pageOf());
  createMock.mockRejectedValue(
    new ApiError({ code: "NETWORK_ERROR", message: "net", details: null, status: 0 }),
  );
  renderCombobox();
  await userEvent.type(screen.getByTestId("purpose-combobox-input"), "Roofing");
  await userEvent.click(await screen.findByTestId("purpose-create-option"));
  expect(await screen.findByTestId("purpose-create-error")).toHaveTextContent(
    "Can't create a purpose while offline.",
  );
});

it("hides Create when canCreate is false (voucher-entry restriction)", async () => {
  listMock.mockResolvedValue(pageOf());
  renderCombobox({ canCreate: false });
  await userEvent.type(screen.getByTestId("purpose-combobox-input"), "Roofing");
  await waitFor(() => expect(listMock).toHaveBeenCalled());
  expect(screen.queryByTestId("purpose-create-option")).not.toBeInTheDocument();
});
