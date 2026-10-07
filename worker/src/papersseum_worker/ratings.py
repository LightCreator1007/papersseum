from papersseum.rating import Ladder, match_scores


def new_ratings(seats, engine_scores):
    """seats: rows (slot, bot_id, elo, games) from lock_match_bots.
    -> ({slot: new_elo}, {slot: blended_score})"""
    ladder = Ladder()
    for slot, _bot_id, elo, games in seats:
        ladder.elo[slot] = elo
        ladder.games[slot] = games

    blended = match_scores(engine_scores)      # coverage % + placement bonus, keyed by pid
    ladder.update_match(blended)
    return {slot: ladder.elo[slot] for slot, *_ in seats}, blended
