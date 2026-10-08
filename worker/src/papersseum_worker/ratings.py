from papersseum.rating import elo_update, match_scores


def new_ratings(seats, engine_scores):
    """seats: rows (slot, bot_id, elo, games) from lock_match_bots, one per slot.
    -> ({slot: new_elo}, {slot: blended_score})"""
    current = {bot_id: (elo, games) for _slot, bot_id, elo, games in seats}
    slot_ids = [bot_id for _slot, bot_id, *_ in sorted(seats)]
    after = elo_update(current, engine_scores, slot_ids)

    blended = match_scores(engine_scores)      # coverage % + placement bonus, keyed by pid
    return {slot: after[bot_id][0] for slot, bot_id, *_ in seats}, blended
