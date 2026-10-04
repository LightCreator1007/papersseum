import enclave.constants as C
from enclave.state import init_match, area_pct
from enclave.movement import intended_moves, apply_decision, rotate, step_delta
from enclave.trail import lay_trail, is_outside_own_land
from enclave.capture import close_trail
from enclave.death import resolve_headon, classify_entry, kill
from enclave.respawn import tick_respawns


class Engine:
    def __init__(self, seed):
        self.state = init_match(seed)

    def advance_tick(self, actions):
        st = self.state
        if st.tick % C.STEP_PER_DECISION == 0 and actions is not None:
            for p in st.players:
                if p.alive:
                    a = actions.get(p.pid, 0)
                    if a not in (0, 1, 2):
                        a = 0
                    apply_decision(st, p.pid, a)

        moves = intended_moves(st)

        # The arena wall is a solid boundary. A head that would step into it is
        # redirected: turn right until it faces open space and move there this
        # same tick, so it slides along the wall instead of freezing. (A convex
        # circle never needs the reverse direction, so 3 right turns suffice.)
        for pid, (nr, nc) in list(moves.items()):
            if classify_entry(st, pid, nr, nc) != "wall":
                continue
            p = st.players[pid]
            h = p.desired_heading
            redirected = False
            for _ in range(3):
                h = rotate(h, 2)                       # turn right
                dr, dc = step_delta(h)
                tr, tc = p.r + dr, p.c + dc
                if classify_entry(st, pid, tr, tc) != "wall":
                    p.desired_heading = h
                    moves[pid] = (tr, tc)
                    redirected = True
                    break
            if not redirected:
                del moves[pid]                         # fully walled (shouldn't happen)

        killed_headon = resolve_headon(st, moves)

        for pid in sorted(moves):
            if pid in killed_headon or not st.players[pid].alive:
                continue
            nr, nc = moves[pid]
            kind = classify_entry(st, pid, nr, nc)
            if kind == "self_trail":
                kill(st, pid)
                continue
            if kind == "cut":
                victim = int(st.trail[nr, nc])
                kill(st, victim, killer=pid)
            p = st.players[pid]
            p.heading = p.desired_heading
            p.r, p.c = nr, nc
            if not is_outside_own_land(st, pid, nr, nc):
                if p.trail_cells:
                    close_trail(st, pid)
            else:
                lay_trail(st, pid, nr, nc)

        tick_respawns(st)
        for p in st.players:
            if p.boost_timer > 0:
                p.boost_timer -= 1
            if p.alive:
                st.cov_sum[p.pid] += area_pct(st, p.pid)
        st.tick += 1

    def is_over(self):
        return self.state.tick >= C.TOTAL_TICKS

    def scores(self):
        st = self.state
        ticks = max(1, st.tick)
        out = []
        for p in st.players:
            out.append({
                "pid": p.pid,
                "coverage": area_pct(st, p.pid) if p.alive else 0.0,
                "time_avg_coverage": st.cov_sum[p.pid] / ticks,
                "deaths": p.deaths,
                "alive": p.alive,
            })
        return out

    def placements(self):
        sc = self.scores()
        ordered = sorted(
            sc,
            key=lambda s: (-s["coverage"], -s["time_avg_coverage"], s["deaths"], s["pid"]),
        )
        return [s["pid"] for s in ordered]
