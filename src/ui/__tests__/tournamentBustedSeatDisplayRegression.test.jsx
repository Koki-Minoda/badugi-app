import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import TournamentEliminatedRail from "../components/TournamentEliminatedRail.jsx";
import {
  buildTournamentEliminatedRailEntries,
  compactTournamentSeatViews,
} from "../utils/tournamentSeatDisplay.js";

afterEach(() => {
  cleanup();
});

describe("tournament busted seat display regression", () => {
  const seats = [
    { seatIndex: 0, name: "You", stack: 720 },
    { seatIndex: 1, name: "Sora", stack: 520, folded: true },
    { seatIndex: 2, name: "Mina", stack: 0, isBusted: true, seatOut: true, finishPlace: 16 },
    { seatIndex: 3, name: "Ren", stack: 0, allIn: true },
  ];

  it("marks eliminated tournament seats hidden from the full table layout", () => {
    const compacted = compactTournamentSeatViews(seats, { isTournament: true });

    expect(compacted[0].hiddenFromTableLayout).not.toBe(true);
    expect(compacted[1].hiddenFromTableLayout).not.toBe(true);
    expect(compacted[2].hiddenFromTableLayout).toBe(true);
    expect(compacted[2].showHand).toBe(false);
    expect(compacted[2].isTurn).toBe(false);
    expect(compacted[3].hiddenFromTableLayout).not.toBe(true);
  });

  it("keeps eliminated players in a compact rail instead of a table panel", () => {
    const entries = buildTournamentEliminatedRailEntries(seats);
    render(<TournamentEliminatedRail entries={entries} layoutMode="mobile" />);

    expect(screen.getByTestId("tournament-eliminated-rail")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /rail/i }));

    expect(screen.getByText("Mina")).toBeTruthy();
    expect(screen.getByText("#16")).toBeTruthy();
    expect(screen.queryByText("Sora")).toBeNull();
    expect(screen.queryByText("Ren")).toBeNull();
  });

  it("does not compact eliminated seats in cash mode", () => {
    const compacted = compactTournamentSeatViews(seats, { isTournament: false });
    expect(compacted[2].hiddenFromTableLayout).not.toBe(true);
  });
  it('preserves eliminated identities after a merge and never lists empty seats as players', () => {
    const entries = buildTournamentEliminatedRailEntries([
      {name:'(Empty Seat 2)', tournamentPlayerId:null, isBusted:true},
      {name:'New opponent', tournamentPlayerId:'cpu-9', stack:900},
    ], {tournamentPlayers:{
      'cpu-2':{id:'cpu-2',name:'Mina',stack:0,busted:true,finishPlace:8},
      'cpu-9':{id:'cpu-9',name:'New opponent',stack:900,busted:false},
    }});
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({id:'cpu-2',name:'Mina',status:'#8'});
    expect(buildTournamentEliminatedRailEntries([{name:'Empty',tournamentPlayerId:null,isBusted:true}])).toEqual([]);
  });
});
