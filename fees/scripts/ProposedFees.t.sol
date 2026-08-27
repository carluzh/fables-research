// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {FablesRWA} from "../../src/FablesRWA.sol";
import {SessionLib} from "../../src/libraries/SessionLib.sol";

contract ProposedFeesTest is Test, Deployers {
    uint256 constant MON_0000 = 1785729600;
    FablesRWA hook;

    struct P { string name; uint24 o; uint24 n; uint24 c; uint8 sm; uint24 cs; uint32 dw; uint24 cf; uint32 cb; uint32 ca; uint24 cap; }

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();
        AccessManager a = new AccessManager(address(this));
        address h = address(uint160(0x4446 << 144) | uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG));
        deployCodeTo("FablesRWA.sol:FablesRWA", abi.encode(manager, address(a), uint24(20_000)), h);
        hook = FablesRWA(h);
    }

    function test_allProposedConfigsValidate() public {
        P[6] memory ps = [
            P("SPY/USDG stage 1",  800,  350, 250, 0,    0,    0,    0,    0, 0,  8000),
            P("SPY/USDG stage 2",  800,  350, 250, 6, 2100, 7200, 1500, 1800, 0,  8000),
            P("NVDA/USDG stage 1",1000,  800, 300, 5, 4000, 7200, 2200, 1800, 0,  8000),
            P("NVDA/USDG stage 2",1400,  800, 300, 5, 4000, 7200, 2200, 1800, 0,  8000),
            P("GLD/USDG",         1500, 1500, 300, 0,    0,    0,    0,    0, 0,  8000),
            P("META/USDG",         900,  750, 250, 0,    0,    0,    0,    0, 0,  8000)
        ];
        for (uint256 i; i < ps.length; ++i) {
            P memory p = ps[i];
            SessionLib.FloorConfig memory cfg = SessionLib.FloorConfig({
                openFloor: p.o, overnightFloor: p.n, closedFloor: p.c, spikeMult: p.sm,
                closedSpike: p.cs, descentWindow: p.dw, closeFloor: p.cf, closeBefore: p.cb, closeAfter: p.ca
            });
            PoolKey memory k =
                PoolKey(currency0, currency1, LPFeeLibrary.DYNAMIC_FEE_FLAG, int24(uint24(10 + i)), IHooks(address(hook)));
            hook.setPoolConfig(k, cfg, p.cap);           // reverts if the validator rejects it
            uint256 total; uint256 peak;
            for (uint256 t = MON_0000; t < MON_0000 + 604800; t += 300) {
                uint256 f = hook.feeFloorAt(cfg, t);
                if (f > peak) peak = f;
                total += f;
            }
            emit log_named_string("pool", p.name);
            emit log_named_uint("  time-weighted pips", total / 2016);
            emit log_named_uint("  peak pips", peak);
            assertLe(peak, p.cap, "peak must sit under the pool cap");
        }
    }
}
