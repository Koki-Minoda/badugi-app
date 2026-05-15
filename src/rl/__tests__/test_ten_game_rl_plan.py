from rl.training.ten_game_rl_plan import (
    TEN_GAME_VARIANT_IDS,
    TIERS,
    build_variant_plan,
)


def test_ten_game_plan_covers_fixed_rotation_and_tiers():
    plan = build_variant_plan(short_episodes=200)

    assert plan["rotation"] == ["B01", "B02", "B06", "ST3", "ST1", "ST2", "D01", "B05", "D03", "S01"]
    assert plan["summary"]["targetVariants"] == 10
    assert plan["summary"]["tierRoutes"] == len(TEN_GAME_VARIANT_IDS) * len(TIERS)

    by_variant = {row["variantId"]: row for row in plan["variants"]}
    assert set(by_variant) == set(TEN_GAME_VARIANT_IDS)

    for variant_id, row in by_variant.items():
        assert row["rewardSource"]
        assert row["actionMaskSource"]
        assert row["datasetSource"]
        assert row["shortEvalGate"]
        assert len(row["tiers"]) == 2
        for tier in row["tiers"]:
            assert tier["tier"] in TIERS
            assert tier["trainCommand"]
            assert tier["shortEvalCommand"]
            assert tier["longRunCommand"]


def test_ten_game_beginner_standard_routes_are_explicit_and_safe():
    plan = build_variant_plan(short_episodes=200)

    assert plan["summary"]["blockingIssueCount"] == 0
    assert plan["summary"]["routeOk"] == plan["summary"]["tierRoutes"]

    badugi = next(row for row in plan["variants"] if row["variantId"] == "D03")
    badugi_beginner = next(tier for tier in badugi["tiers"] if tier["tier"] == "beginner")
    badugi_standard = next(tier for tier in badugi["tiers"] if tier["tier"] == "standard")

    assert badugi_beginner["routeStatus"] == "generic-fallback"
    assert badugi_beginner["fallbackAllowed"] is True
    assert badugi_standard["modelId"] == "model-badugi-standard-dqn-v3"

    for row in plan["variants"]:
        if row["variantId"] == "D03":
            continue
        for tier in row["tiers"]:
            assert tier["routeStatus"] == "variant-model"
            assert tier["assetExists"] is True
            assert tier["shapeMatchesFamily"] is True
