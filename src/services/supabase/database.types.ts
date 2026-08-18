// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Regenerate with `npm run generate:types` (see that script for what it needs).
// Provenance — which schema this was generated from, and when — is in the
// machine-readable sibling `database.types.meta.json`, not in this header,
// because a header comment does not survive regeneration and a provenance
// record that the generator silently deletes is worse than none.
//
// WHAT IT CLOSES. `TYPE-001`: every Supabase call in this repository was
// hand-typed or cast, so a column rename in a migration compiled clean and
// failed at runtime. With 151 migrations and 53 tables that was the
// highest-probability route to a silent defect.
//
// WHAT IT DOES NOT CLOSE. This file being present does not mean it is USED.
// It is only load-bearing where a caller consumes it; see `client.ts`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actual_third_place_resolution_revisions: {
        Row: {
          action: string
          actor_id: string | null
          id: string
          new_resolution: Json
          previous_resolution: Json
          reason: string
          recorded_at: string
          revision: number
          tie_key: string
          tournament_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          id?: string
          new_resolution: Json
          previous_resolution: Json
          reason: string
          recorded_at?: string
          revision: number
          tie_key: string
          tournament_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          id?: string
          new_resolution?: Json
          previous_resolution?: Json
          reason?: string
          recorded_at?: string
          revision?: number
          tie_key?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actual_third_place_resolution_revisions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      actual_third_place_resolutions: {
        Row: {
          basis_hash: string
          created_at: string
          id: string
          last_reason: string
          ordered_team_ids: string[]
          tie_key: string
          tournament_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          basis_hash: string
          created_at?: string
          id?: string
          last_reason: string
          ordered_team_ids: string[]
          tie_key: string
          tournament_id: string
          updated_at?: string
          updated_by?: string | null
          version: number
        }
        Update: {
          basis_hash?: string
          created_at?: string
          id?: string
          last_reason?: string
          ordered_team_ids?: string[]
          tie_key?: string
          tournament_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "actual_third_place_resolutions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_competition_audit: {
        Row: {
          action: string
          actor_id: string | null
          competition_id: string
          detail: Json
          id: string
          recorded_at: string
          tournament_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          competition_id: string
          detail?: Json
          id?: string
          recorded_at?: string
          tournament_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          competition_id?: string
          detail?: Json
          id?: string
          recorded_at?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_audit_tournament_competition_fkey"
            columns: ["tournament_id", "competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_competition_audit_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_competition_entrants: {
        Row: {
          competition_id: string
          game_membership_id: string | null
          joined_at: string
          outcome: string
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          competition_id: string
          game_membership_id?: string | null
          joined_at?: string
          outcome?: string
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          competition_id?: string
          game_membership_id?: string | null
          joined_at?: string
          outcome?: string
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_competition_entrants_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_entrants_membership_fkey"
            columns: [
              "game_membership_id",
              "tournament_id",
              "competition_id",
              "user_id",
            ]
            isOneToOne: false
            referencedRelation: "game_memberships"
            referencedColumns: [
              "id",
              "tournament_id",
              "game_competition_id",
              "user_id",
            ]
          },
          {
            foreignKeyName: "bonus_entrants_tournament_competition_fkey"
            columns: ["tournament_id", "competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      bonus_competition_windows: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          label: string
          locks_at: string | null
          opens_at: string | null
          requires_tie_break_input: boolean
          sequence: number
          settles_at: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          label: string
          locks_at?: string | null
          opens_at?: string | null
          requires_tie_break_input?: boolean
          sequence: number
          settles_at?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          label?: string
          locks_at?: string | null
          opens_at?: string | null
          requires_tie_break_input?: boolean
          sequence?: number
          settles_at?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_competition_windows_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_windows_tournament_competition_fkey"
            columns: ["tournament_id", "competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      bonus_competitions: {
        Row: {
          availability_status: string
          completed_at: string | null
          completion_reason: string | null
          created_at: string
          draw_completed_at: string | null
          draw_required: boolean
          game_key: string
          id: string
          invite_code: string | null
          name: string | null
          owner_id: string | null
          predecessor_competition_id: string | null
          published: boolean
          registration_closes_at: string | null
          registration_opens_at: string | null
          series_id: string
          series_sequence: number
          tournament_id: string
          updated_at: string
          visibility_kind: string
        }
        Insert: {
          availability_status: string
          completed_at?: string | null
          completion_reason?: string | null
          created_at?: string
          draw_completed_at?: string | null
          draw_required?: boolean
          game_key: string
          id?: string
          invite_code?: string | null
          name?: string | null
          owner_id?: string | null
          predecessor_competition_id?: string | null
          published?: boolean
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          series_id: string
          series_sequence?: number
          tournament_id: string
          updated_at?: string
          visibility_kind?: string
        }
        Update: {
          availability_status?: string
          completed_at?: string | null
          completion_reason?: string | null
          created_at?: string
          draw_completed_at?: string | null
          draw_required?: boolean
          game_key?: string
          id?: string
          invite_code?: string | null
          name?: string | null
          owner_id?: string | null
          predecessor_competition_id?: string | null
          published?: boolean
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          series_id?: string
          series_sequence?: number
          tournament_id?: string
          updated_at?: string
          visibility_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_competitions_game_key_fkey"
            columns: ["game_key"]
            isOneToOne: false
            referencedRelation: "game_definitions"
            referencedColumns: ["game_key"]
          },
          {
            foreignKeyName: "bonus_competitions_predecessor_fkey"
            columns: [
              "series_id",
              "predecessor_competition_id",
              "tournament_id",
              "game_key",
              "visibility_kind",
            ]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: [
              "series_id",
              "id",
              "tournament_id",
              "game_key",
              "visibility_kind",
            ]
          },
          {
            foreignKeyName: "bonus_competitions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_cup_fixtures: {
        Row: {
          away_user_id: string
          bracket_slot: number | null
          competition_id: string
          created_at: string
          decided_by: string | null
          group_id: string | null
          home_user_id: string
          id: string
          matchday: number | null
          round_size: number | null
          settled_at: string | null
          stage: string
          tournament_id: string
          window_id: string
          winner_user_id: string | null
        }
        Insert: {
          away_user_id: string
          bracket_slot?: number | null
          competition_id: string
          created_at?: string
          decided_by?: string | null
          group_id?: string | null
          home_user_id: string
          id?: string
          matchday?: number | null
          round_size?: number | null
          settled_at?: string | null
          stage: string
          tournament_id: string
          window_id: string
          winner_user_id?: string | null
        }
        Update: {
          away_user_id?: string
          bracket_slot?: number | null
          competition_id?: string
          created_at?: string
          decided_by?: string | null
          group_id?: string | null
          home_user_id?: string
          id?: string
          matchday?: number | null
          round_size?: number | null
          settled_at?: string | null
          stage?: string
          tournament_id?: string
          window_id?: string
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bonus_cup_fixtures_competition_id_away_user_id_fkey"
            columns: ["competition_id", "away_user_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_entrants"
            referencedColumns: ["competition_id", "user_id"]
          },
          {
            foreignKeyName: "bonus_cup_fixtures_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_cup_fixtures_competition_id_home_user_id_fkey"
            columns: ["competition_id", "home_user_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_entrants"
            referencedColumns: ["competition_id", "user_id"]
          },
          {
            foreignKeyName: "bonus_cup_fixtures_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "bonus_cup_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_cup_fixtures_tournament_competition_fkey"
            columns: ["tournament_id", "competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_cup_fixtures_tournament_group_fkey"
            columns: ["tournament_id", "competition_id", "group_id"]
            isOneToOne: false
            referencedRelation: "bonus_cup_groups"
            referencedColumns: ["tournament_id", "competition_id", "id"]
          },
          {
            foreignKeyName: "bonus_cup_fixtures_tournament_window_fkey"
            columns: ["tournament_id", "competition_id", "window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["tournament_id", "competition_id", "id"]
          },
          {
            foreignKeyName: "bonus_cup_fixtures_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_cup_groups: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          ordinal: number
          parent_group_id: string | null
          phase_kind: string
          size: number
          tournament_id: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          ordinal: number
          parent_group_id?: string | null
          phase_kind?: string
          size: number
          tournament_id: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          ordinal?: number
          parent_group_id?: string | null
          phase_kind?: string
          size?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_cup_groups_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_cup_groups_parent_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "bonus_cup_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_cup_groups_tournament_competition_fkey"
            columns: ["tournament_id", "competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      bonus_cup_launches: {
        Row: {
          competition_id: string
          format_kind: string
          group_stage_last_sequence: number
          launched_at: string
        }
        Insert: {
          competition_id: string
          format_kind: string
          group_stage_last_sequence: number
          launched_at?: string
        }
        Update: {
          competition_id?: string
          format_kind?: string
          group_stage_last_sequence?: number
          launched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_cup_launches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: true
            referencedRelation: "bonus_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_cup_members: {
        Row: {
          competition_id: string
          created_at: string
          draw_number: number
          group_id: string
          group_position: number | null
          phase_kind: string
          qualified_as: string | null
          seed: number | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          draw_number: number
          group_id: string
          group_position?: number | null
          phase_kind?: string
          qualified_as?: string | null
          seed?: number | null
          tournament_id: string
          user_id: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          draw_number?: number
          group_id?: string
          group_position?: number | null
          phase_kind?: string
          qualified_as?: string | null
          seed?: number | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_cup_members_competition_id_user_id_fkey"
            columns: ["competition_id", "user_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_entrants"
            referencedColumns: ["competition_id", "user_id"]
          },
          {
            foreignKeyName: "bonus_cup_members_group_phase_fkey"
            columns: ["competition_id", "group_id", "phase_kind"]
            isOneToOne: false
            referencedRelation: "bonus_cup_groups"
            referencedColumns: ["competition_id", "id", "phase_kind"]
          },
          {
            foreignKeyName: "bonus_cup_members_tournament_competition_fkey"
            columns: ["tournament_id", "competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_cup_members_tournament_group_fkey"
            columns: ["tournament_id", "competition_id", "group_id"]
            isOneToOne: false
            referencedRelation: "bonus_cup_groups"
            referencedColumns: ["tournament_id", "competition_id", "id"]
          },
        ]
      }
      bonus_cup_penalty_numbers: {
        Row: {
          competition_id: string
          created_at: string
          tournament_id: string
          updated_at: string
          user_id: string
          value: number
          version: number
          window_id: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          tournament_id: string
          updated_at?: string
          user_id: string
          value: number
          version?: number
          window_id: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          tournament_id?: string
          updated_at?: string
          user_id?: string
          value?: number
          version?: number
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_cup_penalties_tournament_competition_fkey"
            columns: ["tournament_id", "competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_cup_penalties_tournament_window_fkey"
            columns: ["tournament_id", "competition_id", "window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["tournament_id", "competition_id", "id"]
          },
          {
            foreignKeyName: "bonus_cup_penalty_numbers_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_cup_penalty_numbers_competition_id_user_id_fkey"
            columns: ["competition_id", "user_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_entrants"
            referencedColumns: ["competition_id", "user_id"]
          },
          {
            foreignKeyName: "bonus_cup_penalty_numbers_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_knockout_predictions: {
        Row: {
          advancing_team_id: string | null
          away_score: number
          competition_id: string
          created_at: string
          home_score: number
          id: string
          match_id: string
          tournament_id: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          advancing_team_id?: string | null
          away_score: number
          competition_id: string
          created_at?: string
          home_score: number
          id?: string
          match_id: string
          tournament_id: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          advancing_team_id?: string | null
          away_score?: number
          competition_id?: string
          created_at?: string
          home_score?: number
          id?: string
          match_id?: string
          tournament_id?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_knockout_predictions_advancing_team_id_fkey"
            columns: ["advancing_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_knockout_predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_ko_predictions_tournament_advancing_team_fkey"
            columns: ["tournament_id", "advancing_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_ko_predictions_tournament_competition_fkey"
            columns: ["tournament_id", "competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_ko_predictions_tournament_match_fkey"
            columns: ["tournament_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      bonus_lms_selections: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          team_id: string
          tournament_id: string
          updated_at: string
          used_cycle: number
          user_id: string
          version: number
          window_id: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          team_id: string
          tournament_id: string
          updated_at?: string
          used_cycle?: number
          user_id: string
          version?: number
          window_id: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          team_id?: string
          tournament_id?: string
          updated_at?: string
          used_cycle?: number
          user_id?: string
          version?: number
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_lms_selections_competition_id_user_id_fkey"
            columns: ["competition_id", "user_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_entrants"
            referencedColumns: ["competition_id", "user_id"]
          },
          {
            foreignKeyName: "bonus_lms_selections_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_lms_selections_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_lms_tournament_competition_fkey"
            columns: ["tournament_id", "competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_lms_tournament_team_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_lms_tournament_window_fkey"
            columns: ["tournament_id", "competition_id", "window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["tournament_id", "competition_id", "id"]
          },
        ]
      }
      bonus_predictions: {
        Row: {
          entry_id: string
          golden_boot_player_id: string | null
          id: string
          tournament_id: string
          updated_at: string
          version: number
        }
        Insert: {
          entry_id: string
          golden_boot_player_id?: string | null
          id?: string
          tournament_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          entry_id?: string
          golden_boot_player_id?: string | null
          id?: string
          tournament_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_predictions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_predictions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "entry_totals"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "bonus_predictions_golden_boot_player_id_fkey"
            columns: ["golden_boot_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_predictions_tournament_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_predictions_tournament_player_fkey"
            columns: ["tournament_id", "golden_boot_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      bonus_score_events: {
        Row: {
          calculation_version: number
          category: string
          competition_id: string
          created_at: string
          explanation: string
          id: string
          match_id: string | null
          points: number
          tournament_id: string
          user_id: string
          window_id: string | null
        }
        Insert: {
          calculation_version?: number
          category: string
          competition_id: string
          created_at?: string
          explanation: string
          id?: string
          match_id?: string | null
          points: number
          tournament_id: string
          user_id: string
          window_id?: string | null
        }
        Update: {
          calculation_version?: number
          category?: string
          competition_id?: string
          created_at?: string
          explanation?: string
          id?: string
          match_id?: string | null
          points?: number
          tournament_id?: string
          user_id?: string
          window_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bonus_score_events_competition_id_user_id_fkey"
            columns: ["competition_id", "user_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_entrants"
            referencedColumns: ["competition_id", "user_id"]
          },
          {
            foreignKeyName: "bonus_score_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_score_events_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_scores_tournament_competition_fkey"
            columns: ["tournament_id", "competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_scores_tournament_match_fkey"
            columns: ["tournament_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_scores_tournament_window_fkey"
            columns: ["tournament_id", "competition_id", "window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["tournament_id", "competition_id", "id"]
          },
        ]
      }
      bonus_window_fixtures: {
        Row: {
          created_at: string
          match_id: string
          tournament_id: string
          window_id: string
        }
        Insert: {
          created_at?: string
          match_id: string
          tournament_id: string
          window_id: string
        }
        Update: {
          created_at?: string
          match_id?: string
          tournament_id?: string
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_window_fixtures_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_window_fixtures_tournament_match_fkey"
            columns: ["tournament_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_window_fixtures_tournament_window_fkey"
            columns: ["tournament_id", "window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "bonus_window_fixtures_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_awards: {
        Row: {
          award_key: string
          created_at: string
          detail: Json
          id: string
          label: string
          settled_at: string | null
          tournament_id: string
          winner_player_id: string | null
          winner_team_id: string | null
        }
        Insert: {
          award_key: string
          created_at?: string
          detail?: Json
          id?: string
          label: string
          settled_at?: string | null
          tournament_id: string
          winner_player_id?: string | null
          winner_team_id?: string | null
        }
        Update: {
          award_key?: string
          created_at?: string
          detail?: Json
          id?: string
          label?: string
          settled_at?: string | null
          tournament_id?: string
          winner_player_id?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_awards_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_awards_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_awards_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_follows: {
        Row: {
          favourite_team_id: string | null
          followed_at: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          favourite_team_id?: string | null
          followed_at?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          favourite_team_id?: string | null
          followed_at?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_follows_favourite_team_id_fkey"
            columns: ["favourite_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_follows_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_lock_events: {
        Row: {
          created_at: string
          fixture_basis_hash: string
          id: string
          locked_at: string
          scope_key: string
          scope_type: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          fixture_basis_hash: string
          id?: string
          locked_at: string
          scope_key: string
          scope_type: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          fixture_basis_hash?: string
          id?: string
          locked_at?: string
          scope_key?: string
          scope_type?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_lock_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_rounds: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          ordinal: number
          round_key: string
          tournament_id: string
          window_closes_at: string | null
          window_opens_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label: string
          ordinal: number
          round_key: string
          tournament_id: string
          window_closes_at?: string | null
          window_opens_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          ordinal?: number
          round_key?: string
          tournament_id?: string
          window_closes_at?: string | null
          window_opens_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_rounds_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sport: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sport?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sport?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          created_at: string
          game_competition_id: string | null
          game_membership_id: string | null
          id: string
          submitted_at: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_competition_id?: string | null
          game_membership_id?: string | null
          id?: string
          submitted_at?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_competition_id?: string | null
          game_membership_id?: string | null
          id?: string
          submitted_at?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_membership_fkey"
            columns: [
              "game_membership_id",
              "tournament_id",
              "game_competition_id",
              "user_id",
            ]
            isOneToOne: false
            referencedRelation: "game_memberships"
            referencedColumns: [
              "id",
              "tournament_id",
              "game_competition_id",
              "user_id",
            ]
          },
          {
            foreignKeyName: "entries_tournament_game_fkey"
            columns: ["tournament_id", "game_competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_automatic_submission_outcomes: {
        Row: {
          attempted_at: string
          entry_id: string
          failure_code: string | null
          failure_message: string | null
          id: string
          lock_at: string
          outcome: string
          submitted_at: string | null
          tournament_id: string
        }
        Insert: {
          attempted_at: string
          entry_id: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          lock_at: string
          outcome: string
          submitted_at?: string | null
          tournament_id: string
        }
        Update: {
          attempted_at?: string
          entry_id?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          lock_at?: string
          outcome?: string
          submitted_at?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_auto_outcomes_tournament_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "entry_automatic_submission_outcomes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_automatic_submission_outcomes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_totals"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entry_automatic_submission_outcomes_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      game_definitions: {
        Row: {
          allow_rejoin: boolean
          buffer_minutes: number
          created_at: string
          display_name: string
          game_key: string
          lock_scope: string
          requires_prediction_entry: boolean
          uses_season_prediction_card: boolean
        }
        Insert: {
          allow_rejoin: boolean
          buffer_minutes: number
          created_at?: string
          display_name: string
          game_key: string
          lock_scope: string
          requires_prediction_entry?: boolean
          uses_season_prediction_card?: boolean
        }
        Update: {
          allow_rejoin?: boolean
          buffer_minutes?: number
          created_at?: string
          display_name?: string
          game_key?: string
          lock_scope?: string
          requires_prediction_entry?: boolean
          uses_season_prediction_card?: boolean
        }
        Relationships: []
      }
      game_membership_events: {
        Row: {
          actor_id: string | null
          detail: Json
          event_type: string
          game_competition_id: string
          id: string
          membership_id: string
          recorded_at: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          detail?: Json
          event_type: string
          game_competition_id: string
          id?: string
          membership_id: string
          recorded_at?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          detail?: Json
          event_type?: string
          game_competition_id?: string
          id?: string
          membership_id?: string
          recorded_at?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_membership_events_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "game_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_membership_events_membership_scope_fkey"
            columns: [
              "membership_id",
              "tournament_id",
              "game_competition_id",
              "user_id",
            ]
            isOneToOne: false
            referencedRelation: "game_memberships"
            referencedColumns: [
              "id",
              "tournament_id",
              "game_competition_id",
              "user_id",
            ]
          },
        ]
      }
      game_memberships: {
        Row: {
          active_since: string | null
          created_at: string
          disqualified_at: string | null
          game_competition_id: string
          id: string
          joined_at: string
          left_at: string | null
          rejoin_count: number
          status: string
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_since?: string | null
          created_at?: string
          disqualified_at?: string | null
          game_competition_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          rejoin_count?: number
          status?: string
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_since?: string | null
          created_at?: string
          disqualified_at?: string | null
          game_competition_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          rejoin_count?: number
          status?: string
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_memberships_game_fkey"
            columns: ["tournament_id", "game_competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      group_teams: {
        Row: {
          group_id: string
          id: string
          slot: number
          team_id: string
          tournament_id: string
        }
        Insert: {
          group_id: string
          id?: string
          slot: number
          team_id: string
          tournament_id: string
        }
        Update: {
          group_id?: string
          id?: string
          slot?: number
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_tournament_group_fkey"
            columns: ["tournament_id", "group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "group_teams_tournament_team_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          letter: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          letter: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          letter?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_code_registry: {
        Row: {
          code: string
          competition_id: string | null
          created_at: string
          league_id: string | null
        }
        Insert: {
          code: string
          competition_id?: string | null
          created_at?: string
          league_id?: string | null
        }
        Update: {
          code?: string
          competition_id?: string | null
          created_at?: string
          league_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_code_registry_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_code_registry_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          joined_at: string
          league_id: string
          role: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          league_id: string
          role?: string
          user_id: string
        }
        Update: {
          joined_at?: string
          league_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          game_competition_id: string | null
          id: string
          invite_code: string
          name: string
          owner_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          game_competition_id?: string | null
          id?: string
          invite_code: string
          name: string
          owner_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          game_competition_id?: string | null
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_tournament_game_fkey"
            columns: ["tournament_id", "game_competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "leagues_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_predictions: {
        Row: {
          away_score: number
          created_at: string
          entry_id: string
          home_score: number
          id: string
          joker: boolean
          match_id: string
          tournament_id: string
          updated_at: string
          version: number
        }
        Insert: {
          away_score: number
          created_at?: string
          entry_id: string
          home_score: number
          id?: string
          joker?: boolean
          match_id: string
          tournament_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          away_score?: number
          created_at?: string
          entry_id?: string
          home_score?: number
          id?: string
          joker?: boolean
          match_id?: string
          tournament_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_predictions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_predictions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_totals"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "match_predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_predictions_tournament_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "match_predictions_tournament_match_fkey"
            columns: ["tournament_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      match_result_revisions: {
        Row: {
          action: string
          actor_id: string | null
          id: string
          match_id: string
          new_result: Json
          previous_result: Json
          reason: string | null
          recorded_at: string
          revision: number
          tournament_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          id?: string
          match_id: string
          new_result: Json
          previous_result: Json
          reason?: string | null
          recorded_at?: string
          revision: number
          tournament_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          id?: string
          match_id?: string
          new_result?: Json
          previous_result?: Json
          reason?: string | null
          recorded_at?: string
          revision?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_result_revisions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_result_revisions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_result_revisions_tournament_match_fkey"
            columns: ["tournament_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      matches: {
        Row: {
          away_penalties: number | null
          away_score: number | null
          away_score_120: number | null
          away_score_90: number | null
          away_source: string
          away_team_id: string | null
          confirmed_at: string | null
          corrected_at: string | null
          created_at: string
          fixture_status: string
          group_id: string | null
          home_penalties: number | null
          home_score: number | null
          home_score_120: number | null
          home_score_90: number | null
          home_source: string
          home_team_id: string | null
          id: string
          kickoff_at: string | null
          last_result_reason: string | null
          match_date: string
          match_ref: string
          matchday: number | null
          result_method: string | null
          result_state: string
          result_version: number
          round: string
          round_id: string
          tournament_id: string
          venue: string
          winner_team_id: string | null
        }
        Insert: {
          away_penalties?: number | null
          away_score?: number | null
          away_score_120?: number | null
          away_score_90?: number | null
          away_source: string
          away_team_id?: string | null
          confirmed_at?: string | null
          corrected_at?: string | null
          created_at?: string
          fixture_status?: string
          group_id?: string | null
          home_penalties?: number | null
          home_score?: number | null
          home_score_120?: number | null
          home_score_90?: number | null
          home_source: string
          home_team_id?: string | null
          id?: string
          kickoff_at?: string | null
          last_result_reason?: string | null
          match_date: string
          match_ref: string
          matchday?: number | null
          result_method?: string | null
          result_state?: string
          result_version?: number
          round: string
          round_id: string
          tournament_id: string
          venue: string
          winner_team_id?: string | null
        }
        Update: {
          away_penalties?: number | null
          away_score?: number | null
          away_score_120?: number | null
          away_score_90?: number | null
          away_source?: string
          away_team_id?: string | null
          confirmed_at?: string | null
          corrected_at?: string | null
          created_at?: string
          fixture_status?: string
          group_id?: string | null
          home_penalties?: number | null
          home_score?: number | null
          home_score_120?: number | null
          home_score_90?: number | null
          home_source?: string
          home_team_id?: string | null
          id?: string
          kickoff_at?: string | null
          last_result_reason?: string | null
          match_date?: string
          match_ref?: string
          matchday?: number | null
          result_method?: string | null
          result_state?: string
          result_version?: number
          round?: string
          round_id?: string
          tournament_id?: string
          venue?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_away_team_fkey"
            columns: ["tournament_id", "away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_tournament_group_fkey"
            columns: ["tournament_id", "group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_tournament_home_team_fkey"
            columns: ["tournament_id", "home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_round_id_fkey"
            columns: ["tournament_id", "round_id"]
            isOneToOne: false
            referencedRelation: "competition_rounds"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_tournament_winner_team_fkey"
            columns: ["tournament_id", "winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_rivals: {
        Row: {
          pinned_at: string
          rival_user_id: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          pinned_at?: string
          rival_user_id: string
          tournament_id: string
          user_id: string
        }
        Update: {
          pinned_at?: string
          rival_user_id?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_rivals_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_action_items: {
        Row: {
          action_key: string
          action_type: string
          competition_id: string | null
          completed_at: string | null
          context: Json
          deadline_at: string | null
          expires_at: string | null
          generated_at: string
          invalidated_at: string | null
          priority: number
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_key: string
          action_type: string
          competition_id?: string | null
          completed_at?: string | null
          context?: Json
          deadline_at?: string | null
          expires_at?: string | null
          generated_at?: string
          invalidated_at?: string | null
          priority: number
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_key?: string
          action_type?: string
          competition_id?: string | null
          completed_at?: string | null
          context?: Json
          deadline_at?: string | null
          expires_at?: string | null
          generated_at?: string
          invalidated_at?: string | null
          priority?: number
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_action_items_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "bonus_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_action_items_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_action_state: {
        Row: {
          action_key: string
          dismissed_at: string | null
          seen_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_key: string
          dismissed_at?: string | null
          seen_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_key?: string
          dismissed_at?: string | null
          seen_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          id: string
          name: string
          team_id: string | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          team_id?: string | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          team_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_tournament_team_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      predicted_group_positions: {
        Row: {
          entry_id: string
          group_id: string
          id: string
          position: number
          team_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          entry_id: string
          group_id: string
          id?: string
          position: number
          team_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          entry_id?: string
          group_id?: string
          id?: string
          position?: number
          team_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "predicted_group_positions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predicted_group_positions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_totals"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "predicted_group_positions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predicted_group_positions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predicted_group_positions_tournament_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "predicted_group_positions_tournament_group_fkey"
            columns: ["tournament_id", "group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "predicted_group_positions_tournament_team_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      predicted_progression: {
        Row: {
          entry_id: string
          id: string
          stage: string
          team_id: string
          tournament_id: string
          updated_at: string
          version: number
        }
        Insert: {
          entry_id: string
          id?: string
          stage: string
          team_id: string
          tournament_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          entry_id?: string
          id?: string
          stage?: string
          team_id?: string
          tournament_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "predicted_progression_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predicted_progression_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_totals"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "predicted_progression_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predicted_progression_tournament_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "predicted_progression_tournament_team_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      predicted_tie_resolutions: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          ordered_team_ids: string[]
          scope: string
          tie_key: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          ordered_team_ids: string[]
          scope: string
          tie_key: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          ordered_team_ids?: string[]
          scope?: string
          tie_key?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "predicted_tie_resolutions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predicted_tie_resolutions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_totals"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "predicted_tie_resolutions_tournament_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          last_seen_at: string | null
          last_seen_points: number | null
          onboarding_completed_at: string | null
          onboarding_step: string | null
          reminder_emails: boolean
          welcomed_at: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          last_seen_at?: string | null
          last_seen_points?: number | null
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          reminder_emails?: boolean
          welcomed_at?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          last_seen_at?: string | null
          last_seen_points?: number | null
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          reminder_emails?: boolean
          welcomed_at?: string | null
        }
        Relationships: []
      }
      provider_entity_map: {
        Row: {
          competition_round_id: string | null
          created_at: string
          entity_kind: string
          evidence_ref: string
          id: string
          provider: string
          provider_id: string
          team_id: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          competition_round_id?: string | null
          created_at?: string
          entity_kind: string
          evidence_ref: string
          id?: string
          provider: string
          provider_id: string
          team_id?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          competition_round_id?: string | null
          created_at?: string
          entity_kind?: string
          evidence_ref?: string
          id?: string
          provider?: string
          provider_id?: string
          team_id?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_entity_map_round_fkey"
            columns: ["tournament_id", "competition_round_id"]
            isOneToOne: false
            referencedRelation: "competition_rounds"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "provider_entity_map_team_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "provider_entity_map_tournament_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_poll_targets: {
        Row: {
          cadence_minutes: number
          created_at: string
          enabled: boolean
          id: string
          last_dispatched_at: string | null
          live_cadence_minutes: number
          live_lead_minutes: number
          live_tail_minutes: number
          path: string
          provider: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          cadence_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: string
          last_dispatched_at?: string | null
          live_cadence_minutes?: number
          live_lead_minutes?: number
          live_tail_minutes?: number
          path: string
          provider: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          cadence_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: string
          last_dispatched_at?: string | null
          live_cadence_minutes?: number
          live_lead_minutes?: number
          live_tail_minutes?: number
          path?: string
          provider?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_poll_targets_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_history: {
        Row: {
          captured_at: string
          id: string
          matchday_key: string
          matchday_ord: number
          rank: number
          total_points: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          captured_at?: string
          id?: string
          matchday_key: string
          matchday_ord: number
          rank: number
          total_points: number
          tournament_id: string
          user_id: string
        }
        Update: {
          captured_at?: string
          id?: string
          matchday_key?: string
          matchday_ord?: number
          rank?: number
          total_points?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_history_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          action: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      reminder_deliveries: {
        Row: {
          action_key: string
          attempts: number
          created_at: string
          deadline_at: string
          dry_run: boolean
          id: string
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string | null
          provider: string | null
          provider_message_id: string | null
          reminder_kind: string
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_key: string
          attempts?: number
          created_at?: string
          deadline_at: string
          dry_run?: boolean
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          reminder_kind?: string
          scheduled_for: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_key?: string
          attempts?: number
          created_at?: string
          deadline_at?: string
          dry_run?: boolean
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          reminder_kind?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      score_events: {
        Row: {
          calculation_version: number
          category: string
          created_at: string
          entry_id: string
          explanation: string
          id: string
          joker: boolean
          match_id: string | null
          points: number
          team_id: string | null
          tournament_id: string
        }
        Insert: {
          calculation_version?: number
          category: string
          created_at?: string
          entry_id: string
          explanation: string
          id?: string
          joker?: boolean
          match_id?: string | null
          points: number
          team_id?: string | null
          tournament_id: string
        }
        Update: {
          calculation_version?: number
          category?: string
          created_at?: string
          entry_id?: string
          explanation?: string
          id?: string
          joker?: boolean
          match_id?: string | null
          points?: number
          team_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_totals"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "score_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_tournament_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "score_events_tournament_match_fkey"
            columns: ["tournament_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "score_events_tournament_team_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      season_cup_window_fixtures: {
        Row: {
          created_at: string
          season_fixture_id: string
          window_id: string
        }
        Insert: {
          created_at?: string
          season_fixture_id: string
          window_id: string
        }
        Update: {
          created_at?: string
          season_fixture_id?: string
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_cup_window_fixtures_season_fixture_id_fkey"
            columns: ["season_fixture_id"]
            isOneToOne: false
            referencedRelation: "season_fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_cup_window_fixtures_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "bonus_competition_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      season_fixture_awards: {
        Row: {
          away_goals: number
          decided_by: string | null
          home_goals: number
          reason: string
          recorded_at: string
          season_fixture_id: string
          tournament_id: string
        }
        Insert: {
          away_goals: number
          decided_by?: string | null
          home_goals: number
          reason: string
          recorded_at?: string
          season_fixture_id: string
          tournament_id: string
        }
        Update: {
          away_goals?: number
          decided_by?: string | null
          home_goals?: number
          reason?: string
          recorded_at?: string
          season_fixture_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_fixture_awards_season_fixture_id_fkey"
            columns: ["season_fixture_id"]
            isOneToOne: true
            referencedRelation: "season_fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_fixture_awards_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      season_fixtures: {
        Row: {
          away_score: number | null
          away_team_id: string
          competition_round_id: string
          created_at: string
          home_score: number | null
          home_team_id: string
          id: string
          kickoff_at: string | null
          replay_fixture_id: string | null
          status: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          competition_round_id: string
          created_at?: string
          home_score?: number | null
          home_team_id: string
          id?: string
          kickoff_at?: string | null
          replay_fixture_id?: string | null
          status?: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          competition_round_id?: string
          created_at?: string
          home_score?: number | null
          home_team_id?: string
          id?: string
          kickoff_at?: string | null
          replay_fixture_id?: string | null
          status?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_fixtures_away_team_fkey"
            columns: ["tournament_id", "away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "season_fixtures_home_team_fkey"
            columns: ["tournament_id", "home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "season_fixtures_replay_fkey"
            columns: ["tournament_id", "replay_fixture_id"]
            isOneToOne: false
            referencedRelation: "season_fixtures"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "season_fixtures_round_fkey"
            columns: ["tournament_id", "competition_round_id"]
            isOneToOne: false
            referencedRelation: "competition_rounds"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      season_lms_entrant_state: {
        Row: {
          competition_id: string
          lives_remaining: number
          saves_remaining: number
          updated_at: string
          user_id: string
        }
        Insert: {
          competition_id: string
          lives_remaining: number
          saves_remaining: number
          updated_at?: string
          user_id: string
        }
        Update: {
          competition_id?: string
          lives_remaining?: number
          saves_remaining?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_lms_entrant_state_entrant_fkey"
            columns: ["competition_id", "user_id"]
            isOneToOne: true
            referencedRelation: "bonus_competition_entrants"
            referencedColumns: ["competition_id", "user_id"]
          },
        ]
      }
      season_lms_setups: {
        Row: {
          competition_id: string
          created_at: string
          draws_rule: string
          endgame_on_wipeout: string | null
          endgame_scope: string
          lives: number
          saves: number
          updated_at: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          draws_rule: string
          endgame_on_wipeout?: string | null
          endgame_scope: string
          lives: number
          saves: number
          updated_at?: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          draws_rule?: string
          endgame_on_wipeout?: string | null
          endgame_scope?: string
          lives?: number
          saves?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_lms_setups_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: true
            referencedRelation: "bonus_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      season_matchweek_cards: {
        Row: {
          competition_round_id: string
          confirmed_at: string | null
          created_at: string
          entry_id: string
          id: string
          status: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          competition_round_id: string
          confirmed_at?: string | null
          created_at?: string
          entry_id: string
          id?: string
          status: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          competition_round_id?: string
          confirmed_at?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          status?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_matchweek_cards_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "season_matchweek_cards_round_fkey"
            columns: ["tournament_id", "competition_round_id"]
            isOneToOne: false
            referencedRelation: "competition_rounds"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      season_matchweek_jokers: {
        Row: {
          competition_round_id: string
          created_at: string
          entry_id: string
          id: string
          tournament_id: string
        }
        Insert: {
          competition_round_id: string
          created_at?: string
          entry_id: string
          id?: string
          tournament_id: string
        }
        Update: {
          competition_round_id?: string
          created_at?: string
          entry_id?: string
          id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_matchweek_jokers_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "season_matchweek_jokers_round_fkey"
            columns: ["tournament_id", "competition_round_id"]
            isOneToOne: false
            referencedRelation: "competition_rounds"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      season_matchweek_scores: {
        Row: {
          competition_round_id: string
          created_at: string
          entry_id: string
          fixtures_scored: number
          joker_applied: boolean
          points: number
          settled_at: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          competition_round_id: string
          created_at?: string
          entry_id: string
          fixtures_scored: number
          joker_applied?: boolean
          points: number
          settled_at?: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          competition_round_id?: string
          created_at?: string
          entry_id?: string
          fixtures_scored?: number
          joker_applied?: boolean
          points?: number
          settled_at?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_matchweek_scores_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "season_matchweek_scores_round_fkey"
            columns: ["tournament_id", "competition_round_id"]
            isOneToOne: false
            referencedRelation: "competition_rounds"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      season_matchweek_submission_outcomes: {
        Row: {
          attempted_at: string
          auto_completed: boolean | null
          competition_round_id: string
          entry_id: string
          id: string
          locks_at: string
          outcome: string
          refusal_reason: string | null
          submitted_at: string | null
          tournament_id: string
        }
        Insert: {
          attempted_at: string
          auto_completed?: boolean | null
          competition_round_id: string
          entry_id: string
          id?: string
          locks_at: string
          outcome: string
          refusal_reason?: string | null
          submitted_at?: string | null
          tournament_id: string
        }
        Update: {
          attempted_at?: string
          auto_completed?: boolean | null
          competition_round_id?: string
          entry_id?: string
          id?: string
          locks_at?: string
          outcome?: string
          refusal_reason?: string | null
          submitted_at?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_matchweek_outcomes_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "season_matchweek_outcomes_round_fkey"
            columns: ["tournament_id", "competition_round_id"]
            isOneToOne: false
            referencedRelation: "competition_rounds"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      season_predictions: {
        Row: {
          away_score: number
          created_at: string
          entry_id: string
          home_score: number
          id: string
          season_fixture_id: string
          tournament_id: string
          updated_at: string
          version: number
        }
        Insert: {
          away_score: number
          created_at?: string
          entry_id: string
          home_score: number
          id?: string
          season_fixture_id: string
          tournament_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          away_score?: number
          created_at?: string
          entry_id?: string
          home_score?: number
          id?: string
          season_fixture_id?: string
          tournament_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_predictions_entry_fkey"
            columns: ["tournament_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "season_predictions_fixture_fkey"
            columns: ["tournament_id", "season_fixture_id"]
            isOneToOne: false
            referencedRelation: "season_fixtures"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      season_table_adjustments: {
        Row: {
          decided_by: string | null
          effective_from: string
          id: string
          points_delta: number
          reason: string
          recorded_at: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          decided_by?: string | null
          effective_from?: string
          id?: string
          points_delta: number
          reason: string
          recorded_at?: string
          team_id: string
          tournament_id: string
        }
        Update: {
          decided_by?: string | null
          effective_from?: string
          id?: string
          points_delta?: number
          reason?: string
          recorded_at?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_table_adjustments_team_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      season_table_rules: {
        Row: {
          playoff_places: number
          points_draw: number
          points_loss: number
          points_win: number
          promotion_places: number
          relegation_places: number
          tie_breakers: string[]
          tournament_id: string
          updated_at: string
        }
        Insert: {
          playoff_places?: number
          points_draw?: number
          points_loss?: number
          points_win?: number
          promotion_places?: number
          relegation_places?: number
          tie_breakers?: string[]
          tournament_id: string
          updated_at?: string
        }
        Update: {
          playoff_places?: number
          points_draw?: number
          points_loss?: number
          points_win?: number
          promotion_places?: number
          relegation_places?: number
          tie_breakers?: string[]
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_table_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      season_wrapped: {
        Row: {
          best_matchweek_ordinal: number | null
          best_matchweek_points: number | null
          correct_outcomes: number
          entry_id: string
          exact_scores: number
          field_size: number
          final_points: number
          final_rank: number
          finalised_at: string
          fixtures_predicted: number
          jokers_played: number
          matchweeks_played: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          best_matchweek_ordinal?: number | null
          best_matchweek_points?: number | null
          correct_outcomes?: number
          entry_id: string
          exact_scores?: number
          field_size: number
          final_points: number
          final_rank: number
          finalised_at?: string
          fixtures_predicted?: number
          jokers_played?: number
          matchweeks_played: number
          tournament_id: string
          user_id: string
        }
        Update: {
          best_matchweek_ordinal?: number | null
          best_matchweek_points?: number | null
          correct_outcomes?: number
          entry_id?: string
          exact_scores?: number
          field_size?: number
          final_points?: number
          final_rank?: number
          finalised_at?: string
          fixtures_predicted?: number
          jokers_played?: number
          matchweeks_played?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_wrapped_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_wrapped_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_totals"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "season_wrapped_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          competition_id: string
          created_at: string
          display_timezone: string
          ends_on: string | null
          golden_boot_player_id: string | null
          id: string
          kind: string
          lock_at: string | null
          name: string
          season_key: string
          starts_on: string | null
          status: string
          year: number
        }
        Insert: {
          competition_id: string
          created_at?: string
          display_timezone: string
          ends_on?: string | null
          golden_boot_player_id?: string | null
          id?: string
          kind: string
          lock_at?: string | null
          name: string
          season_key: string
          starts_on?: string | null
          status: string
          year: number
        }
        Update: {
          competition_id?: string
          created_at?: string
          display_timezone?: string
          ends_on?: string | null
          golden_boot_player_id?: string | null
          id?: string
          kind?: string
          lock_at?: string | null
          name?: string
          season_key?: string
          starts_on?: string | null
          status?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_golden_boot_player_id_fkey"
            columns: ["golden_boot_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      entry_totals: {
        Row: {
          entry_id: string | null
          total_points: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _actual_group_order: { Args: { p_group_id: string }; Returns: string[] }
      _group_h2h_stats: {
        Args: { p_group_id: string; p_team_ids: string[] }
        Returns: {
          gd: number
          gf: number
          pts: number
          team_id: string
        }[]
      }
      _resolve_group_cluster: {
        Args: { p_group_id: string; p_team_ids: string[] }
        Returns: string[]
      }
      _stage_ord: { Args: { p_stage: string }; Returns: number }
      acknowledge_provider_review_items: {
        Args: { p_ids: string[]; p_kind: string; p_note?: string }
        Returns: Json
      }
      admin_actual_third_place_tie_revisions: {
        Args: { p_tournament_id: string }
        Returns: {
          action: string
          new_resolution: Json
          previous_resolution: Json
          reason: string
          recorded_at: string
          revision: number
        }[]
      }
      admin_actual_third_place_tie_status: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      admin_ai_bet_builder_books: { Args: never; Returns: Json }
      admin_ai_bet_builder_candidates: {
        Args: {
          p_bookmaker: string
          p_from?: string
          p_leagues?: string[]
          p_limit?: number
          p_to?: string
        }
        Returns: Json
      }
      admin_ai_betting_dashboard: { Args: { p_league?: string }; Returns: Json }
      admin_ai_betting_gate_status: { Args: never; Returns: Json }
      admin_ai_dashboard: { Args: { p_league?: string }; Returns: Json }
      admin_ai_evidence_by_market: { Args: never; Returns: Json }
      admin_ai_odds_api_status: { Args: never; Returns: Json }
      admin_ai_performance_breakdown: {
        Args: { p_league?: string }
        Returns: Json
      }
      admin_ai_prediction_audit: {
        Args: { p_hours?: number; p_league?: string }
        Returns: Json
      }
      admin_ai_promote_model: {
        Args: { p_model_id: string; p_reason: string }
        Returns: Json
      }
      admin_ai_recent_results: {
        Args: { p_league?: string; p_limit?: number }
        Returns: Json
      }
      admin_ai_recommendation_log: {
        Args: { p_league?: string; p_limit?: number }
        Returns: Json
      }
      admin_ai_upcoming_predictions: {
        Args: { p_league?: string; p_limit?: number }
        Returns: Json
      }
      admin_approve_initial_provider_fixtures: {
        Args: { p_provider: string; p_reason: string; p_tournament_id: string }
        Returns: Json
      }
      admin_award_fixture_outcome: {
        Args: {
          p_away_goals: number
          p_home_goals: number
          p_reason: string
          p_season_fixture_id: string
        }
        Returns: Json
      }
      admin_clear_actual_third_place_tie: {
        Args: { p_reason: string; p_tournament_id: string }
        Returns: Json
      }
      admin_clear_match_result: {
        Args: { p_match_id: string; p_reason: string }
        Returns: Json
      }
      admin_clear_season_fixture_result: {
        Args: { p_reason: string; p_season_fixture_id: string }
        Returns: Json
      }
      admin_competition_entrants: {
        Args: { p_competition_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      admin_confirm_match_result: {
        Args: {
          p_away_120?: number
          p_away_90: number
          p_away_penalties?: number
          p_home_120?: number
          p_home_90: number
          p_home_penalties?: number
          p_match_id: string
          p_method: string
          p_reason?: string
        }
        Returns: Json
      }
      admin_confirm_season_fixture_result: {
        Args: {
          p_away: number
          p_home: number
          p_reason?: string
          p_season_fixture_id: string
        }
        Returns: Json
      }
      admin_correct_match_result: {
        Args: {
          p_away_120?: number
          p_away_90: number
          p_away_penalties?: number
          p_home_120?: number
          p_home_90: number
          p_home_penalties?: number
          p_match_id: string
          p_method: string
          p_reason?: string
        }
        Returns: Json
      }
      admin_correct_season_fixture_result: {
        Args: {
          p_away: number
          p_home: number
          p_reason: string
          p_season_fixture_id: string
        }
        Returns: Json
      }
      admin_decide_provider_change_proposal: {
        Args: { p_decision: string; p_proposal_id: string; p_reason?: string }
        Returns: Json
      }
      admin_disqualify_competition_game_entry: {
        Args: {
          p_game_competition_id: string
          p_reason: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_draw_predictor_cup: {
        Args: { p_competition_id: string; p_seed: string }
        Returns: Json
      }
      admin_finalise_predictor_cup_groups: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      admin_finalise_season_cup_groups: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      admin_launch_cup_group_stage: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      admin_match_result_revisions: {
        Args: { p_match_id: string }
        Returns: {
          action: string
          actor_id: string
          new_result: Json
          previous_result: Json
          reason: string
          recorded_at: string
          revision: number
        }[]
      }
      admin_open_season_competition: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      admin_provider_change_proposals: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_state?: string
          p_tournament_id: string
        }
        Returns: Json
      }
      admin_provider_proposal_detail: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_provider?: string
          p_tournament_id: string
        }
        Returns: Json
      }
      admin_record_table_adjustment: {
        Args: {
          p_effective_from?: string
          p_points_delta: number
          p_reason: string
          p_team_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      admin_reject_initial_provider_fixtures: {
        Args: { p_provider: string; p_reason: string; p_tournament_id: string }
        Returns: Json
      }
      admin_reminder_delivery_health: { Args: never; Returns: Json }
      admin_resolve_actual_third_place_tie: {
        Args: {
          p_ordered_team_ids: string[]
          p_reason: string
          p_tournament_id: string
        }
        Returns: Json
      }
      admin_set_competition_table_rules: {
        Args: {
          p_playoff_places: number
          p_points_draw: number
          p_points_loss: number
          p_points_win: number
          p_promotion_places: number
          p_relegation_places: number
          p_tie_breakers: string[]
          p_tournament_id: string
        }
        Returns: Json
      }
      admin_settle_predictor_cup_round: {
        Args: { p_competition_id: string; p_window_id: string }
        Returns: Json
      }
      admin_shadow_scoring_report: {
        Args: { p_limit?: number; p_tournament_id: string }
        Returns: Json
      }
      admin_transition_euro_publication_state: {
        Args: {
          p_expected_state: string
          p_next_state: string
          p_reason: string
        }
        Returns: {
          changed_at: string
          state: string
        }[]
      }
      ai_odds_budget_check: {
        Args: { p_estimated_cost: number }
        Returns: Json
      }
      archive_provider_response: {
        Args: {
          p_correlation_id?: string
          p_provider: string
          p_raw_body: string
          p_request_method: string
          p_request_url: string
          p_response_headers: Json
          p_response_status: number
        }
        Returns: string
      }
      capture_rank_history: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      claim_due_reminders: {
        Args: { p_dry_run?: boolean; p_limit?: number }
        Returns: {
          action_key: string
          attempts: number
          deadline_at: string
          dry_run: boolean
          email: string
          id: string
          reminder_kind: string
          user_id: string
        }[]
      }
      clear_match_result: {
        Args: { p_match_id: string; p_reason: string }
        Returns: Json
      }
      clear_my_predictions: { Args: { p_tournament_id: string }; Returns: Json }
      confirm_match_result: {
        Args: {
          p_away_120?: number
          p_away_90: number
          p_away_penalties?: number
          p_home_120?: number
          p_home_90: number
          p_home_penalties?: number
          p_match_id: string
          p_method: string
          p_reason?: string
        }
        Returns: Json
      }
      confirm_season_matchweek_card: {
        Args: { p_matchweek: number; p_tournament_id: string }
        Returns: Json
      }
      correct_match_result: {
        Args: {
          p_away_120?: number
          p_away_90: number
          p_away_penalties?: number
          p_home_120?: number
          p_home_90: number
          p_home_penalties?: number
          p_match_id: string
          p_method: string
          p_reason?: string
        }
        Returns: Json
      }
      create_game_league: {
        Args: { p_game_competition_id: string; p_name: string }
        Returns: {
          id: string
          invite_code: string
          name: string
        }[]
      }
      create_league: {
        Args: { p_name: string; p_tournament_id: string }
        Returns: {
          id: string
          invite_code: string
          name: string
        }[]
      }
      create_private_season_cup: {
        Args: { p_name: string; p_tournament_id: string }
        Returns: Json
      }
      create_private_season_lms: {
        Args: {
          p_draws_rule?: string
          p_endgame_on_wipeout?: string
          p_lives?: number
          p_name: string
          p_saves?: number
          p_tournament_id: string
        }
        Returns: Json
      }
      delete_knockout_prediction: {
        Args: { p_expected_version: number; p_match_id: string }
        Returns: boolean
      }
      delete_league: { Args: { p_league_id: string }; Returns: undefined }
      delete_match_prediction: {
        Args: {
          p_entry_id: string
          p_expected_version: number
          p_match_id: string
        }
        Returns: boolean
      }
      dismiss_action: { Args: { p_action_key: string }; Returns: Json }
      dispatch_ai_odds_polls: { Args: { p_force?: boolean }; Returns: Json }
      dispatch_due_provider_polls: { Args: { p_now?: string }; Returns: Json }
      enforce_rate_limit: {
        Args: { p_action: string; p_max_per_min: number }
        Returns: undefined
      }
      euro_publication_state: {
        Args: never
        Returns: {
          changed_at: string
          state: string
        }[]
      }
      gen_invite_code: { Args: never; Returns: string }
      get_bonus_games: { Args: { p_tournament_id: string }; Returns: Json }
      get_competition_games: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_competition_table: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_entry_submission_status: {
        Args: { p_entry_id: string }
        Returns: Json
      }
      get_game_leave_eligibility: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_h2h_rank_history: {
        Args: { p_rival_id: string; p_tournament_id: string }
        Returns: Json
      }
      get_ko_predictor_standings: {
        Args: { p_after?: string; p_limit?: number; p_tournament_id: string }
        Returns: Json
      }
      get_leaderboard: {
        Args: { p_after?: string; p_limit?: number; p_tournament_id: string }
        Returns: Json
      }
      get_league: {
        Args: { p_league_id: string }
        Returns: {
          id: string
          invite_code: string
          is_owner: boolean
          member_count: number
          name: string
          owner_id: string
          owner_name: string
        }[]
      }
      get_league_match_picks: {
        Args: { p_league_id: string; p_match_id: string }
        Returns: Json
      }
      get_league_members: {
        Args: { p_after?: string; p_league_id: string; p_limit?: number }
        Returns: Json
      }
      get_league_preview: {
        Args: { p_code: string }
        Returns: {
          is_member: boolean
          name: string
        }[]
      }
      get_match_prediction_distribution: {
        Args: { p_match_id: string }
        Returns: Json
      }
      get_my_actions: {
        Args: { p_include_dismissed?: boolean; p_limit?: number }
        Returns: Json
      }
      get_my_cup: { Args: { p_tournament_id: string }; Returns: Json }
      get_my_football_calendar: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      get_my_game_leagues: {
        Args: { p_game_competition_id: string }
        Returns: {
          id: string
          invite_code: string
          is_owner: boolean
          last_activity_at: string
          member_count: number
          name: string
          owner_name: string
        }[]
      }
      get_my_knockout_predictions: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_my_leagues: {
        Args: { p_tournament_id: string }
        Returns: {
          id: string
          invite_code: string
          is_owner: boolean
          last_activity_at: string
          member_count: number
          name: string
          owner_name: string
        }[]
      }
      get_my_lms: { Args: { p_tournament_id: string }; Returns: Json }
      get_my_organised_competition: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      get_my_organised_competitions: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_my_preferences: { Args: never; Returns: Json }
      get_my_private_competitions: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_my_season_cup_instances: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_my_season_history: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_player_profile: {
        Args: { p_player_id: string; p_tournament_id: string }
        Returns: Json
      }
      get_prediction_consensus: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_private_competition_workspace: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      get_provider_review_queues: {
        Args: { p_limit?: number; p_tournament_id: string }
        Returns: Json
      }
      get_public_capacity: {
        Args: never
        Returns: {
          league_creation_available: boolean
          leagues_used: number
          public_user_limit: number
          public_users_used: number
          signup_available: boolean
          total_league_limit: number
        }[]
      }
      get_published_weekly_seasons: { Args: never; Returns: Json }
      get_rival_entry: {
        Args: { p_rival_id: string; p_tournament_id: string }
        Returns: Json
      }
      get_season_club_form: {
        Args: { p_matches?: number; p_tournament_id: string }
        Returns: Json
      }
      get_season_club_head_to_head: {
        Args: {
          p_opponent_id: string
          p_team_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      get_season_clubs: { Args: { p_tournament_id: string }; Returns: Json }
      get_season_cup_bracket: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      get_season_cup_group_stage: {
        Args: { p_competition_id: string; p_group_ordinal?: number }
        Returns: Json
      }
      get_season_cup_phase: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      get_season_cup_player_view: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      get_season_fixture: {
        Args: { p_season_fixture_id: string }
        Returns: Json
      }
      get_season_fixtures: {
        Args: { p_from?: string; p_to?: string; p_tournament_id: string }
        Returns: Json
      }
      get_season_head_to_head: {
        Args: {
          p_matchweek: number
          p_opponent_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      get_season_leaderboard: {
        Args: { p_after?: string; p_limit?: number; p_tournament_id: string }
        Returns: Json
      }
      get_season_leaderboard_neighbourhood: {
        Args: { p_tournament_id: string; p_window?: number }
        Returns: Json
      }
      get_season_league_matchweek_predictions: {
        Args: { p_competition_round_id: string; p_league_id: string }
        Returns: Json
      }
      get_season_league_rank_movement: {
        Args: { p_competition_round_id?: string; p_league_id: string }
        Returns: Json
      }
      get_season_league_standings: {
        Args: { p_after?: string; p_league_id: string; p_limit?: number }
        Returns: Json
      }
      get_season_lms_field: {
        Args: { p_tournament_id: string; p_window_sequence?: number }
        Returns: Json
      }
      get_season_lms_round: { Args: { p_tournament_id: string }; Returns: Json }
      get_season_matchweek_card: {
        Args: { p_matchweek: number; p_tournament_id: string }
        Returns: Json
      }
      get_season_matchweek_projection: {
        Args: {
          p_league_id?: string
          p_matchweek: number
          p_tournament_id: string
        }
        Returns: Json
      }
      get_season_period_standings:
        | {
            Args: {
              p_period: string
              p_tournament_id: string
              p_window?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_include_names: boolean
              p_period: string
              p_tournament_id: string
              p_window: number
            }
            Returns: Json
          }
      get_season_play_context: {
        Args: { p_competition_slug: string; p_season_key: string }
        Returns: Json
      }
      get_season_player_profile: {
        Args: { p_player_id: string; p_tournament_id: string }
        Returns: Json
      }
      get_season_prediction_consensus: {
        Args: { p_matchweek: number; p_tournament_id: string }
        Returns: Json
      }
      get_season_prediction_dna: {
        Args: { p_player_id: string; p_tournament_id: string }
        Returns: Json
      }
      get_season_rank_history: {
        Args: { p_player_ref?: string; p_tournament_id: string }
        Returns: Json
      }
      get_season_rivalry: {
        Args: {
          p_opponent_ref: string
          p_recent?: number
          p_tournament_id: string
        }
        Returns: Json
      }
      get_season_wrapped: { Args: { p_tournament_id: string }; Returns: Json }
      join_competition_game: {
        Args: { p_game_competition_id: string }
        Returns: Json
      }
      join_league: {
        Args: { p_code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      join_private_competition: { Args: { p_code: string }; Returns: Json }
      launch_private_season_cup: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      leave_competition_game: {
        Args: { p_game_competition_id: string }
        Returns: Json
      }
      leave_league: { Args: { p_league_id: string }; Returns: undefined }
      mark_actions_seen: { Args: { p_action_keys: string[] }; Returns: Json }
      process_due_entry_submissions: { Args: { p_now?: string }; Returns: Json }
      process_due_lms_restarts: { Args: { p_now?: string }; Returns: Json }
      process_due_season_lms_settlements: {
        Args: { p_now?: string }
        Returns: Json
      }
      process_due_season_matchweek_scores: { Args: never; Returns: Json }
      process_due_season_matchweek_submissions: {
        Args: { p_now?: string }
        Returns: Json
      }
      process_player_action_items: { Args: never; Returns: Json }
      process_reminder_schedule: {
        Args: { p_dry_run?: boolean; p_lead?: string }
        Returns: Json
      }
      reclaim_stalled_reminders: {
        Args: { p_stale_after?: string }
        Returns: Json
      }
      recompute_all_scores: { Args: never; Returns: undefined }
      recompute_tournament_scores: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      record_ai_odds_snapshot: {
        Args: {
          p_decoder_version: string
          p_error_detail?: string
          p_estimated_cost: number
          p_normalized_payload: Json
          p_raw_body: string
          p_reported_cost: number
          p_reported_remaining: number
          p_reported_used: number
          p_request_url: string
          p_response_headers: Json
          p_response_status: number
        }
        Returns: Json
      }
      record_provider_response_processing: {
        Args: {
          p_decoded_fixture_count?: number
          p_decoder_version: string
          p_error_code?: string
          p_error_detail?: string
          p_normalized_payload?: Json
          p_raw_response_id: string
          p_succeeded: boolean
        }
        Returns: string
      }
      record_reminder_result: {
        Args: {
          p_error?: string
          p_id: string
          p_provider?: string
          p_provider_message_id?: string
          p_sent: boolean
        }
        Returns: Json
      }
      register_bonus_competition: {
        Args: { p_competition_id: string }
        Returns: Json
      }
      replace_predicted_progression: {
        Args: { p_desired: Json; p_entry_id: string; p_expected_versions: Json }
        Returns: {
          stage: string
          team_id: string
          version: number
        }[]
      }
      resolve_invite_code: { Args: { p_code: string }; Returns: Json }
      resolve_season_player: {
        Args: { p_player_ref: string; p_tournament_id: string }
        Returns: Json
      }
      rotate_league_invite_code: {
        Args: { p_league_id: string }
        Returns: string
      }
      run_shadow_scoring_verification: {
        Args: { p_max_rounds?: number; p_tournament_id: string }
        Returns: Json
      }
      save_knockout_prediction: {
        Args: {
          p_advancing_team_id: string
          p_away: number
          p_expected_version: number
          p_home: number
          p_match_id: string
        }
        Returns: Json
      }
      save_lms_selection: {
        Args: {
          p_expected_version: number
          p_team_id: string
          p_window_id: string
        }
        Returns: Json
      }
      save_season_prediction: {
        Args: {
          p_away: number
          p_home: number
          p_season_fixture_id: string
          p_tournament_id: string
          p_version: number
        }
        Returns: Json
      }
      save_season_predictions_batch: {
        Args: { p_drafts: Json; p_tournament_id: string }
        Returns: Json
      }
      search_league_transfer_candidates: {
        Args: { p_league_id: string; p_limit?: number; p_query?: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      set_competition_follow: {
        Args: {
          p_favourite_team_id?: string
          p_following: boolean
          p_tournament_id: string
        }
        Returns: Json
      }
      set_league_member_limit: { Args: { p_limit: number }; Returns: Json }
      set_onboarding_progress: {
        Args: { p_completed?: boolean; p_step: string }
        Returns: Json
      }
      set_operating_limits: {
        Args: { p_public_user_limit: number; p_total_league_limit: number }
        Returns: Json
      }
      set_pinned_rival: {
        Args: {
          p_pinned?: boolean
          p_rival_user_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      set_season_matchweek_joker: {
        Args: {
          p_matchweek: number
          p_played: boolean
          p_tournament_id: string
        }
        Returns: Json
      }
      submit_cup_penalty_number: {
        Args: {
          p_competition_id: string
          p_expected_version: number
          p_value: number
          p_window_id: string
        }
        Returns: Json
      }
      submit_entry: { Args: { p_entry_id: string }; Returns: string }
      transfer_ownership: {
        Args: { p_league_id: string; p_new_owner: string }
        Returns: undefined
      }
      withdraw_bonus_competition: {
        Args: { p_competition_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

