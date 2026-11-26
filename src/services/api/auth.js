import { baseApi } from './baseApi';

// /auth — email/password → JWT (ADR-011). The token lands in secure-store + the `auth` slice; the only
// place it's attached to a request is baseApi.prepareHeaders. login/refresh are exempt from the 401 refresh+logout
// (a bad password must surface as an inline error, not blow away the session). (PRD §4)
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    refresh: build.mutation({
      query: (body) => ({ url: '/auth/refresh', method: 'POST', body }),
    }),
    logout: build.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
  }),
});

export const { useLoginMutation, useRefreshMutation, useLogoutMutation } = authApi;
