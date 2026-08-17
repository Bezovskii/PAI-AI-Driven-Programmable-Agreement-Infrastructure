import assert from "node:assert/strict";
import test from "node:test";

import {
    buildApp,
} from "../src/app.js";

import type {
    ResolveSession,
    RevokeSession,
} from "../src/auth/session.js";

const COOKIE_NAME =
    "esct_session";

const RAW_TOKEN =
    "raw-session-token";

const WALLET =
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

interface TestAppOptions {
    readonly resolveSession?:
    ResolveSession;

    readonly revokeSession?:
    RevokeSession;
}

function createTestApp(
    options: TestAppOptions = {},
) {
    return buildApp({
        logger:
            false,

        readinessProbe:
            async () =>
                true,

        auth: {
            issueNonce:
                async (
                    walletAddress,
                ) => ({
                    walletAddress,

                    nonce:
                        "test-nonce",

                    expiresAt:
                        new Date(
                            "2026-08-17T20:00:00.000Z",
                        ),
                }),

            ...(
                options.resolveSession
                    ? {
                        resolveSession:
                            options.resolveSession,
                    }
                    : {}
            ),

            ...(
                options.revokeSession
                    ? {
                        revokeSession:
                            options.revokeSession,
                    }
                    : {}
            ),

            sessionCookie: {
                name:
                    COOKIE_NAME,

                secure:
                    false,

                maxAgeSeconds:
                    604800,
            },

            siwe: {
                domain:
                    "localhost:5173",

                uri:
                    "http://localhost:5173",

                chainId:
                    31337,
            },
        },
    });
}

/* =========================================================
   SESSION RESTORE
   ========================================================= */

test(
    "GET /api/v1/auth/session returns 401 when cookie is missing",
    async (t) => {
        let resolverCalled =
            false;

        const app =
            createTestApp({
                resolveSession:
                    async () => {
                        resolverCalled =
                            true;

                        return null;
                    },
            });

        t.after(
            async () => {
                await app.close();
            },
        );

        const response =
            await app.inject({
                method:
                    "GET",

                url:
                    "/api/v1/auth/session",
            });

        assert.equal(
            response.statusCode,
            401,
        );

        assert.deepEqual(
            response.json(),
            {
                error:
                    "unauthenticated",
            },
        );

        assert.equal(
            resolverCalled,
            false,
        );
    },
);

test(
    "GET /api/v1/auth/session restores authenticated wallet from cookie",
    async (t) => {
        let receivedToken =
            "";

        const app =
            createTestApp({
                resolveSession:
                    async (
                        rawToken,
                    ) => {
                        receivedToken =
                            rawToken;

                        return {
                            userId:
                                "user-1",

                            walletAddress:
                                WALLET,
                        };
                    },
            });

        t.after(
            async () => {
                await app.close();
            },
        );

        const response =
            await app.inject({
                method:
                    "GET",

                url:
                    "/api/v1/auth/session",

                headers: {
                    cookie:
                        `${COOKIE_NAME}=${RAW_TOKEN}`,
                },
            });

        assert.equal(
            response.statusCode,
            200,
        );

        assert.equal(
            receivedToken,
            RAW_TOKEN,
        );

        assert.deepEqual(
            response.json(),
            {
                authenticated:
                    true,

                walletAddress:
                    WALLET,
            },
        );
    },
);

test(
    "GET /api/v1/auth/session returns 401 for invalid session",
    async (t) => {
        const app =
            createTestApp({
                resolveSession:
                    async () =>
                        null,
            });

        t.after(
            async () => {
                await app.close();
            },
        );

        const response =
            await app.inject({
                method:
                    "GET",

                url:
                    "/api/v1/auth/session",

                headers: {
                    cookie:
                        `${COOKIE_NAME}=${RAW_TOKEN}`,
                },
            });

        assert.equal(
            response.statusCode,
            401,
        );

        assert.deepEqual(
            response.json(),
            {
                error:
                    "unauthenticated",
            },
        );
    },
);

/* =========================================================
   LOGOUT
   ========================================================= */

test(
    "POST /api/v1/auth/logout revokes current session and clears cookie",
    async (t) => {
        let receivedToken =
            "";

        const app =
            createTestApp({
                revokeSession:
                    async (
                        rawToken,
                    ) => {
                        receivedToken =
                            rawToken;

                        return true;
                    },
            });

        t.after(
            async () => {
                await app.close();
            },
        );

        const response =
            await app.inject({
                method:
                    "POST",

                url:
                    "/api/v1/auth/logout",

                headers: {
                    cookie:
                        `${COOKIE_NAME}=${RAW_TOKEN}`,
                },
            });

        assert.equal(
            response.statusCode,
            200,
        );

        assert.equal(
            receivedToken,
            RAW_TOKEN,
        );

        assert.deepEqual(
            response.json(),
            {
                loggedOut:
                    true,
            },
        );

        const setCookie =
            String(
                response.headers[
                "set-cookie"
                ] ?? "",
            );

        assert.match(
            setCookie,
            /esct_session=/,
        );

        assert.match(
            setCookie,
            /Path=\//i,
        );
    },
);

test(
    "POST /api/v1/auth/logout is idempotent without session cookie",
    async (t) => {
        let revokeCalled =
            false;

        const app =
            createTestApp({
                revokeSession:
                    async () => {
                        revokeCalled =
                            true;

                        return true;
                    },
            });

        t.after(
            async () => {
                await app.close();
            },
        );

        const response =
            await app.inject({
                method:
                    "POST",

                url:
                    "/api/v1/auth/logout",
            });

        assert.equal(
            response.statusCode,
            200,
        );

        assert.deepEqual(
            response.json(),
            {
                loggedOut:
                    true,
            },
        );

        assert.equal(
            revokeCalled,
            false,
        );
    },
);

test(
    "revoked session cannot be restored after logout",
    async (t) => {
        let revoked =
            false;

        const resolveSession:
            ResolveSession =
            async (
                rawToken,
            ) => {
                if (
                    rawToken !==
                    RAW_TOKEN ||
                    revoked
                ) {
                    return null;
                }

                return {
                    userId:
                        "user-1",

                    walletAddress:
                        WALLET,
                };
            };

        const revokeSession:
            RevokeSession =
            async (
                rawToken,
            ) => {
                if (
                    rawToken !==
                    RAW_TOKEN
                ) {
                    return false;
                }

                revoked =
                    true;

                return true;
            };

        const app =
            createTestApp({
                resolveSession,
                revokeSession,
            });

        t.after(
            async () => {
                await app.close();
            },
        );

        const cookie = {
            cookie:
                `${COOKIE_NAME}=${RAW_TOKEN}`,
        };

        const beforeLogout =
            await app.inject({
                method:
                    "GET",

                url:
                    "/api/v1/auth/session",

                headers:
                    cookie,
            });

        assert.equal(
            beforeLogout.statusCode,
            200,
        );

        const logout =
            await app.inject({
                method:
                    "POST",

                url:
                    "/api/v1/auth/logout",

                headers:
                    cookie,
            });

        assert.equal(
            logout.statusCode,
            200,
        );

        const afterLogout =
            await app.inject({
                method:
                    "GET",

                url:
                    "/api/v1/auth/session",

                headers:
                    cookie,
            });

        assert.equal(
            afterLogout.statusCode,
            401,
        );

        assert.deepEqual(
            afterLogout.json(),
            {
                error:
                    "unauthenticated",
            },
        );
    },
);