import importlib.util
import unittest
from pathlib import Path


RUNTIME_PATH = (
    Path(__file__).resolve().parent
    / "intelligence_server.py"
)

SPEC = importlib.util.spec_from_file_location(
    "pai_intelligence_runtime",
    RUNTIME_PATH,
)

if SPEC is None or SPEC.loader is None:
    raise RuntimeError(
        "Unable to load Intelligence runtime."
    )

RUNTIME = importlib.util.module_from_spec(
    SPEC
)
SPEC.loader.exec_module(
    RUNTIME
)


class RepairModelOutputStructureTest(
    unittest.TestCase
):
    def test_repairs_known_model_schema_drift(
        self,
    ) -> None:
        value = {
            "agreement": {
                "pricing": {
                    "total": {
                        "amount": "1000",
                        "currency": {
                            "code": "USDC",
                            "symbol": "USDC",
                        },
                    },
                    "settlementAsset": {
                        "type": "token",
                        "symbol": "USDC",
                        "networkId": "arc-testnet",
                        "assetId": "arc-testnet:usdc",
                    },
                },
                "milestones": [
                    {
                        "deadline": {
                            "type": "absolute_date",
                            "date": "2026-09-20",
                            "timezone": "UTC",
                        },
                    },
                ],
                "payments": [
                    {
                        "amount": {
                            "amount": "1000",
                            "currency": {
                                "code": "USDC",
                                "symbol": "USDC",
                            },
                        },
                        "trigger": {
                            "type": "milestone_accepted",
                        },
                    },
                ],
            },
        }

        repaired = (
            RUNTIME
            .repair_model_output_structure(
                value
            )
        )

        pricing = repaired[
            "agreement"
        ]["pricing"]

        self.assertIsNone(
            pricing["total"]["currency"]["code"]
        )
        self.assertEqual(
            pricing["total"]["currency"]["symbol"],
            "USDC",
        )
        self.assertIsNone(
            pricing["settlementAsset"]["networkId"]
        )
        self.assertIsNone(
            pricing["settlementAsset"]["assetId"]
        )

        deadline = repaired[
            "agreement"
        ]["milestones"][0]["deadline"]

        self.assertIsNone(
            deadline["time"]
        )
        self.assertIsNone(
            deadline["duration"]
        )
        self.assertIsNone(
            deadline["relativeTo"]
        )

        payment = repaired[
            "agreement"
        ]["payments"][0]

        self.assertIsNone(
            payment["sharePercent"]
        )
        self.assertIsNone(
            payment["payerPartyId"]
        )
        self.assertIsNone(
            payment["recipientPartyId"]
        )
        self.assertIsNone(
            payment["trigger"]["milestoneId"]
        )
        self.assertIsNone(
            payment["trigger"]["timing"]
        )

    def test_preserves_valid_identifiers(
        self,
    ) -> None:
        value = {
            "agreement": {
                "pricing": {
                    "total": {
                        "amount": "1000",
                        "currency": {
                            "code": "USD",
                            "symbol": "$",
                        },
                    },
                    "settlementAsset": {
                        "type": "token",
                        "symbol": "USDC",
                        "networkId": "eip155:1",
                        "assetId": (
                            "eip155:1/erc20:"
                            "0x0000000000000000000000000000000000000000"
                        ),
                    },
                },
                "milestones": [],
                "payments": [],
            },
        }

        repaired = (
            RUNTIME
            .repair_model_output_structure(
                value
            )
        )

        pricing = repaired[
            "agreement"
        ]["pricing"]

        self.assertEqual(
            pricing["total"]["currency"]["code"],
            "USD",
        )
        self.assertEqual(
            pricing["settlementAsset"]["networkId"],
            "eip155:1",
        )
        self.assertEqual(
            pricing["settlementAsset"]["assetId"],
            (
                "eip155:1/erc20:"
                "0x0000000000000000000000000000000000000000"
            ),
        )


if __name__ == "__main__":
    unittest.main()
