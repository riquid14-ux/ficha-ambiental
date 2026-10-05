import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { requiresTwoFactorEnrollment } from "@shared/two-factor-policy";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Nunca expor stack traces, paths internos ou a mensagem de uma exceção
    // inesperada. O detalhe técnico permanece apenas no registo do servidor.
    const message = error.code === "INTERNAL_SERVER_ERROR"
      ? "Ocorreu um erro interno. Tente novamente ou contacte o apoio."
      : shape.message;
    return {
      ...shape,
      message,
      data: { ...shape.data, stack: undefined },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next, type } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (type === "mutation") {
    // O adaptador Express expõe `get`. Chamadores internos (por exemplo, testes
    // de contrato) não trazem um pedido HTTP e não devem simular uma origem.
    // Quando existe um pedido de browser, a validação permanece obrigatória.
    const request = ctx.req as typeof ctx.req & { get?: (name: string) => string | undefined };
    if (typeof request.get === "function") {
      const origin = request.get("origin");
      const host = request.get("host");
      if (origin && host && origin !== `${request.protocol}://${host}`) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Origem de pedido não autorizada." });
      }
    }
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const TWO_FACTOR_ENROLLMENT_PATHS = new Set([
  "auth.setup2FA",
  "auth.confirm2FA",
  "auth.logout",
]);

const PASSWORD_CHANGE_PATHS = new Set([
  "auth.me",
  "auth.changePassword",
  "auth.setup2FA",
  "auth.confirm2FA",
  "auth.disable2FA",
  "auth.logout",
]);

const enforceTwoFactorEnrollment = t.middleware(async opts => {
  const { ctx, next, path } = opts;
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (requiresTwoFactorEnrollment(ctx.user) && !TWO_FACTOR_ENROLLMENT_PATHS.has(path)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A autenticação de dois fatores tem de ser configurada antes de continuar.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const enforcePasswordChange = t.middleware(async opts => {
  const { ctx, next, path } = opts;
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (ctx.user.mustChangePassword && !PASSWORD_CHANGE_PATHS.has(path)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Altere a palavra-passe temporária antes de aceder à plataforma.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const partnerAllowedProcedure = t.procedure
  .use(requireUser)
  .use(enforceTwoFactorEnrollment)
  .use(enforcePasswordChange);

const blockPartnerByDefault = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.user.role === "ee_partner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Este perfil só pode aceder aos módulos KPI e Resíduos autorizados.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = partnerAllowedProcedure.use(blockPartnerByDefault);

export const adminProcedure = partnerAllowedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== 'admin' && ctx.user.role !== 'dono_obra')) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
