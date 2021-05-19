import { Logger } from "@aws-amplify/core";
import {
  DendronApiV2,
  DEngineInitPayload,
  NotePropsDict,
} from "@dendronhq/common-all";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import _ from "lodash";

/**
 * Equivalent to engine.init
 */
export const initNotes = createAsyncThunk(
  "engine/init",
  async ({ port, ws }: { port: number; ws: string }, { dispatch }) => {
    const logger = new Logger("initNotesThunk");
    logger.info({ state: "enter" });
    const api = new DendronApiV2({
      endpoint: `http://localhost:${port}`,
      apiPath: "api",
      logger,
    });
    logger.info({ state: "pre:workspaceSync" });
    const resp = await api.workspaceSync({ ws });
    logger.info({ state: "post:workspaceSync" });
    const data = resp.data;
    if (resp.error || _.isUndefined(data)) {
      dispatch(setError(resp.error));
      return resp;
    }
    logger.info({ state: "pre:setNotes" });
    dispatch(setFromInit(data));
    logger.info({ state: "post:setNotes" });
    return resp;
  }
);

export type InitNoteOpts = Parameters<typeof initNotes>[0];

type InitialState = InitializedState;
type InitializedState = {
  error: any;
  loading: "idle" | "pending" | "fulfilled";
  currentRequestId: string | undefined;
} & Partial<DEngineInitPayload>;

export type EngineState = InitializedState;
export const engineSlice = createSlice({
  name: "engine",
  initialState: {
    loading: "idle" as const,
    notes: {},
    schemas: {},
    error: null,
  } as InitialState,
  reducers: {
    setFromInit: (state, action: PayloadAction<DEngineInitPayload>) => {
      const { notes, wsRoot, schemas, vaults, config } = action.payload;
      state.notes = notes;
      state.wsRoot = wsRoot;
      state.schemas = schemas;
      state.vaults = vaults;
      state.config = config;
    },
    setNotes: (state, action: PayloadAction<NotePropsDict>) => {
      state.notes = action.payload;
    },
    setError: (state, action: PayloadAction<any>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    const logger = new Logger("engineSlice");
    builder.addCase(initNotes.pending, (state, { meta }) => {
      logger.info({ state: "start:initNotes", requestId: meta.requestId });
      if (state.loading === "idle") {
        state.loading = "pending";
        state.currentRequestId = meta.requestId;
      }
    });
    // @ts-ignore
    builder.addCase(initNotes.fulfilled, (state, { payload, meta }) => {
      const { requestId } = meta;
      logger.info({
        state: "fin:initNotes",
        requestId: state.currentRequestId,
      });
      if (state.loading === "pending" && state.currentRequestId === requestId) {
        state.loading = "idle";
        state.currentRequestId = undefined;
      }
    });
  },
});

export class EngineSliceUtils {
  static hasInitialized(engine: InitialState) {
    return (
      engine.loading === "idle" &&
      !_.isUndefined(engine.notes) &&
      !_.isUndefined(engine.vaults)
    );
  }
}
export const { setNotes, setError, setFromInit } = engineSlice.actions;
export const reducer = engineSlice.reducer;