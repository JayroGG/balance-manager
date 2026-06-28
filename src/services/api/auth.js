import { baseApi } from './baseApi';

// /auth — email/password → JWT (ADR-011). The token lands in secure-store + the `auth` slice; the only
// place it's attached to a request is baseApi.prepareHeaders. login is exempt from the 401 auto-logout
// (a bad password must surface as an inline error, not blow away the session). (PRD §4)
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    logout: build.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation } = authApi;
