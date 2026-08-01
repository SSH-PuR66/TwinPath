const mockEnabled = import.meta.env.VITE_E2E_MOCK_AUTH === "1";

if (mockEnabled && import.meta.env.PROD) {
  throw new Error("VITE_E2E_MOCK_AUTH cannot run in a production build.");
}

export const isE2EMockAuth = mockEnabled;

export const mockSession = {
  access_token: "fixture-not-a-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: "fixture-not-a-refresh-token",
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "fixture@example.test",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    role: "authenticated",
  },
};

export const mockProfile = {
  id: mockSession.user.id,
  display_name: "Fixture Member",
  email: mockSession.user.email,
  track: "household",
};

export const mockHousehold = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Fixture Household",
};

const mockTasks = [
  "Review fixture plan",
  "Check fixture calendar",
  "Compare fixture options",
  "Prepare fixture documents",
  "Confirm fixture reminder",
  "Update fixture checklist",
  "Schedule fixture review",
  "Close fixture loop",
].map((title, index) => ({
  id: `task-${index + 1}`,
  title,
  category: "Fixture",
  priority: index < 2 ? "high" : "normal",
  completed: false,
  due_date: `2026-08-${String(index + 1).padStart(2, "0")}`,
  household_id: mockHousehold.id,
  owner_user_id: mockSession.user.id,
}));

export const mockAppData = {
  tasks: mockTasks,
  appointments: [
    {
      id: "appointment-1",
      title: "Fixture review",
      starts_at: "2026-08-03T14:00:00.000Z",
      household_id: mockHousehold.id,
      owner_user_id: mockSession.user.id,
    },
  ],
  transactions: [
    { id: "transaction-1", kind: "income", amount: 120, category: "Fixture", description: "Fixture income", transaction_date: "2026-07-01" },
    { id: "transaction-2", kind: "expense", amount: 45, category: "Fixture", description: "Fixture expense", transaction_date: "2026-07-02" },
    { id: "transaction-3", kind: "expense", amount: 30, category: "Fixture", description: "Fixture expense", transaction_date: "2026-07-03" },
  ],
  opportunities: [
    { id: "opportunity-1", title: "Fixture route", status: "researching", household_id: mockHousehold.id },
    { id: "opportunity-2", title: "Fixture route", status: "ready", household_id: mockHousehold.id },
  ],
  documents: [],
};

const mockTables = {
  profiles: [mockProfile],
  household_members: [{ household_id: mockHousehold.id, role: "owner", households: mockHousehold }],
  tasks: mockAppData.tasks,
  appointments: mockAppData.appointments,
  transactions: mockAppData.transactions,
  income_opportunities: mockAppData.opportunities,
  documents: mockAppData.documents,
  feature_flags: [],
};

function result(data) {
  return Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : null });
}

function queryFor(table) {
  const rows = mockTables[table] || [];

  // Terminal operations: these resolve the chain rather than continue it.
  const terminal = {
    maybeSingle() { return result(rows[0] ?? null); },
    single() { return result(rows[0] ?? null); },
    csv() { return result(""); },
    then(resolve, reject) { return result(rows).then(resolve, reject); },
  };

  // Every other builder method (eq, in, contains, abortSignal, filter, ...) is a no-op
  // that keeps the chain alive. This used to be a hand-written list, which silently fell
  // behind the real PostgREST builder: missing `contains` and `abortSignal` threw on
  // every home render. A proxy cannot drift out of sync the same way.
  const query = new Proxy(terminal, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      if (typeof prop === "symbol") return undefined;
      return () => query;
    },
    has() { return true; },
  });

  return query;
}

export function createMockSupabaseClient() {
  return {
    auth: {
      getSession: () => result({ session: mockSession }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: () => result(null),
      updateUser: () => result({ user: mockSession.user }),
      signInWithPassword: () => result({ session: mockSession }),
      signInWithOtp: () => result(null),
      verifyOtp: () => result({ session: mockSession }),
    },
    from: queryFor,
    rpc: () => result(null),
    channel() {
      const channel = { on() { return channel; }, subscribe() { return channel; } };
      return channel;
    },
    removeChannel: () => result(null),
    storage: {
      from() {
        return {
          upload: () => result(null),
          remove: () => result(null),
          createSignedUrl: () => result({ signedUrl: "" }),
        };
      },
    },
  };
}
