export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      ai_analysis_runs: {
        Row: {
          advantages: string[]
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          executive_summary: string | null
          id: string
          input_tokens: number | null
          limitations_and_risks: string[]
          model: string | null
          novelty_points: string[]
          output_tokens: number | null
          owner_user_id: string
          patent_id: string
          prompt_version: string
          proposed_solution: string | null
          result_json: Json | null
          source_pdf_path_snapshot: string | null
          started_at: string | null
          status: string
          technical_problem: string | null
          total_tokens: number | null
          updated_at: string
        }
        Insert: {
          advantages?: string[]
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          executive_summary?: string | null
          id?: string
          input_tokens?: number | null
          limitations_and_risks?: string[]
          model?: string | null
          novelty_points?: string[]
          output_tokens?: number | null
          owner_user_id: string
          patent_id: string
          prompt_version: string
          proposed_solution?: string | null
          result_json?: Json | null
          source_pdf_path_snapshot?: string | null
          started_at?: string | null
          status?: string
          technical_problem?: string | null
          total_tokens?: number | null
          updated_at?: string
        }
        Update: {
          advantages?: string[]
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          executive_summary?: string | null
          id?: string
          input_tokens?: number | null
          limitations_and_risks?: string[]
          model?: string | null
          novelty_points?: string[]
          output_tokens?: number | null
          owner_user_id?: string
          patent_id?: string
          prompt_version?: string
          proposed_solution?: string | null
          result_json?: Json | null
          source_pdf_path_snapshot?: string | null
          started_at?: string | null
          status?: string
          technical_problem?: string | null
          total_tokens?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_runs_patent_owner_fk"
            columns: ["patent_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "patents"
            referencedColumns: ["id", "owner_user_id"]
          },
        ]
      }
      ai_analysis_suggestions: {
        Row: {
          confidence_score: number | null
          created_at: string
          evidence_page: number | null
          evidence_quote: string | null
          id: string
          label: string
          matched_category_id: string | null
          matched_chemical_id: string | null
          matched_commercial_product_id: string | null
          matched_purpose_id: string | null
          matched_role_id: string | null
          normalized_value: string | null
          owner_user_id: string
          patent_id: string
          payload: Json
          review_status: string
          reviewed_at: string | null
          run_id: string
          suggestion_type: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          evidence_page?: number | null
          evidence_quote?: string | null
          id?: string
          label: string
          matched_category_id?: string | null
          matched_chemical_id?: string | null
          matched_commercial_product_id?: string | null
          matched_purpose_id?: string | null
          matched_role_id?: string | null
          normalized_value?: string | null
          owner_user_id: string
          patent_id: string
          payload?: Json
          review_status?: string
          reviewed_at?: string | null
          run_id: string
          suggestion_type: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          evidence_page?: number | null
          evidence_quote?: string | null
          id?: string
          label?: string
          matched_category_id?: string | null
          matched_chemical_id?: string | null
          matched_commercial_product_id?: string | null
          matched_purpose_id?: string | null
          matched_role_id?: string | null
          normalized_value?: string | null
          owner_user_id?: string
          patent_id?: string
          payload?: Json
          review_status?: string
          reviewed_at?: string | null
          run_id?: string
          suggestion_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_suggestions_matched_category_id_fkey"
            columns: ["matched_category_id"]
            isOneToOne: false
            referencedRelation: "application_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_suggestions_matched_chemical_id_fkey"
            columns: ["matched_chemical_id"]
            isOneToOne: false
            referencedRelation: "chemicals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_suggestions_matched_commercial_product_id_fkey"
            columns: ["matched_commercial_product_id"]
            isOneToOne: false
            referencedRelation: "commercial_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_suggestions_matched_purpose_id_fkey"
            columns: ["matched_purpose_id"]
            isOneToOne: false
            referencedRelation: "technical_purposes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_suggestions_matched_role_id_fkey"
            columns: ["matched_role_id"]
            isOneToOne: false
            referencedRelation: "chemical_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_suggestions_run_owner_fk"
            columns: ["run_id", "patent_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "ai_analysis_runs"
            referencedColumns: ["id", "patent_id", "owner_user_id"]
          },
        ]
      }
      application_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          parent_category_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          parent_category_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          parent_category_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "application_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chemical_roles: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      chemical_synonyms: {
        Row: {
          chemical_id: string
          created_at: string
          id: string
          synonym: string
        }
        Insert: {
          chemical_id: string
          created_at?: string
          id?: string
          synonym: string
        }
        Update: {
          chemical_id?: string
          created_at?: string
          id?: string
          synonym?: string
        }
        Relationships: [
          {
            foreignKeyName: "chemical_synonyms_chemical_id_fkey"
            columns: ["chemical_id"]
            isOneToOne: false
            referencedRelation: "chemicals"
            referencedColumns: ["id"]
          },
        ]
      }
      chemicals: {
        Row: {
          abbreviation: string | null
          canonical_name: string
          cas_number: string | null
          chemical_class: string | null
          created_at: string
          id: string
          molecular_formula: string | null
          notes: string | null
          owner_user_id: string | null
          smiles: string | null
          updated_at: string
        }
        Insert: {
          abbreviation?: string | null
          canonical_name: string
          cas_number?: string | null
          chemical_class?: string | null
          created_at?: string
          id?: string
          molecular_formula?: string | null
          notes?: string | null
          owner_user_id?: string | null
          smiles?: string | null
          updated_at?: string
        }
        Update: {
          abbreviation?: string | null
          canonical_name?: string
          cas_number?: string | null
          chemical_class?: string | null
          created_at?: string
          id?: string
          molecular_formula?: string | null
          notes?: string | null
          owner_user_id?: string | null
          smiles?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      commercial_product_chemicals: {
        Row: {
          chemical_id: string
          commercial_product_id: string
          concentration_max: number | null
          concentration_min: number | null
          concentration_unit: string | null
          created_at: string
        }
        Insert: {
          chemical_id: string
          commercial_product_id: string
          concentration_max?: number | null
          concentration_min?: number | null
          concentration_unit?: string | null
          created_at?: string
        }
        Update: {
          chemical_id?: string
          commercial_product_id?: string
          concentration_max?: number | null
          concentration_min?: number | null
          concentration_unit?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_product_chemicals_chemical_id_fkey"
            columns: ["chemical_id"]
            isOneToOne: false
            referencedRelation: "chemicals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_product_chemicals_commercial_product_id_fkey"
            columns: ["commercial_product_id"]
            isOneToOne: false
            referencedRelation: "commercial_products"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          manufacturer: string | null
          notes: string | null
          owner_user_id: string | null
          product_type: string | null
          trade_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          manufacturer?: string | null
          notes?: string | null
          owner_user_id?: string | null
          product_type?: string | null
          trade_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          manufacturer?: string | null
          notes?: string | null
          owner_user_id?: string | null
          product_type?: string | null
          trade_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      patent_application_categories: {
        Row: {
          category_id: string
          created_at: string
          patent_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          patent_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          patent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patent_application_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "application_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patent_application_categories_patent_id_fkey"
            columns: ["patent_id"]
            isOneToOne: false
            referencedRelation: "patents"
            referencedColumns: ["id"]
          },
        ]
      }
      patent_chemicals: {
        Row: {
          ai_suggested: boolean
          chemical_id: string | null
          chemical_role_id: string
          commercial_product_id: string | null
          confidence_score: number | null
          created_at: string
          id: string
          patent_id: string
          raw_material_name: string | null
          source_end_offset: number | null
          source_page: number | null
          source_quote: string | null
          source_section: string | null
          source_start_offset: number | null
          source_type: string
          updated_at: string
          user_confirmed: boolean
        }
        Insert: {
          ai_suggested?: boolean
          chemical_id?: string | null
          chemical_role_id: string
          commercial_product_id?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          patent_id: string
          raw_material_name?: string | null
          source_end_offset?: number | null
          source_page?: number | null
          source_quote?: string | null
          source_section?: string | null
          source_start_offset?: number | null
          source_type?: string
          updated_at?: string
          user_confirmed?: boolean
        }
        Update: {
          ai_suggested?: boolean
          chemical_id?: string | null
          chemical_role_id?: string
          commercial_product_id?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          patent_id?: string
          raw_material_name?: string | null
          source_end_offset?: number | null
          source_page?: number | null
          source_quote?: string | null
          source_section?: string | null
          source_start_offset?: number | null
          source_type?: string
          updated_at?: string
          user_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "patent_chemicals_chemical_id_fkey"
            columns: ["chemical_id"]
            isOneToOne: false
            referencedRelation: "chemicals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patent_chemicals_chemical_role_id_fkey"
            columns: ["chemical_role_id"]
            isOneToOne: false
            referencedRelation: "chemical_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patent_chemicals_commercial_product_id_fkey"
            columns: ["commercial_product_id"]
            isOneToOne: false
            referencedRelation: "commercial_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patent_chemicals_patent_id_fkey"
            columns: ["patent_id"]
            isOneToOne: false
            referencedRelation: "patents"
            referencedColumns: ["id"]
          },
        ]
      }
      patent_tags: {
        Row: {
          created_at: string
          patent_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          patent_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          patent_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patent_tags_patent_id_fkey"
            columns: ["patent_id"]
            isOneToOne: false
            referencedRelation: "patents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patent_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      patent_technical_purposes: {
        Row: {
          created_at: string
          patent_id: string
          purpose_id: string
        }
        Insert: {
          created_at?: string
          patent_id: string
          purpose_id: string
        }
        Update: {
          created_at?: string
          patent_id?: string
          purpose_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patent_technical_purposes_patent_id_fkey"
            columns: ["patent_id"]
            isOneToOne: false
            referencedRelation: "patents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patent_technical_purposes_purpose_id_fkey"
            columns: ["purpose_id"]
            isOneToOne: false
            referencedRelation: "technical_purposes"
            referencedColumns: ["id"]
          },
        ]
      }
      patents: {
        Row: {
          abstract_text: string | null
          ai_analysis_status: string
          ai_summary: string | null
          application_number: string | null
          archived: boolean
          assignee: string | null
          country_code: string | null
          favorite: boolean
          filing_date: string | null
          id: string
          inventors: string[]
          language: string | null
          notes: string | null
          owner_user_id: string
          patent_number: string | null
          pdf_mime_type: string | null
          pdf_original_filename: string | null
          pdf_size_bytes: number | null
          pdf_storage_path: string | null
          priority_date: string | null
          publication_date: string | null
          publication_number: string | null
          title: string | null
          updated_at: string
          uploaded_at: string
          user_summary: string | null
        }
        Insert: {
          abstract_text?: string | null
          ai_analysis_status?: string
          ai_summary?: string | null
          application_number?: string | null
          archived?: boolean
          assignee?: string | null
          country_code?: string | null
          favorite?: boolean
          filing_date?: string | null
          id?: string
          inventors?: string[]
          language?: string | null
          notes?: string | null
          owner_user_id: string
          patent_number?: string | null
          pdf_mime_type?: string | null
          pdf_original_filename?: string | null
          pdf_size_bytes?: number | null
          pdf_storage_path?: string | null
          priority_date?: string | null
          publication_date?: string | null
          publication_number?: string | null
          title?: string | null
          updated_at?: string
          uploaded_at?: string
          user_summary?: string | null
        }
        Update: {
          abstract_text?: string | null
          ai_analysis_status?: string
          ai_summary?: string | null
          application_number?: string | null
          archived?: boolean
          assignee?: string | null
          country_code?: string | null
          favorite?: boolean
          filing_date?: string | null
          id?: string
          inventors?: string[]
          language?: string | null
          notes?: string | null
          owner_user_id?: string
          patent_number?: string | null
          pdf_mime_type?: string | null
          pdf_original_filename?: string | null
          pdf_size_bytes?: number | null
          pdf_storage_path?: string | null
          priority_date?: string | null
          publication_date?: string | null
          publication_number?: string | null
          title?: string | null
          updated_at?: string
          uploaded_at?: string
          user_summary?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      technical_purposes: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_purposes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "technical_purposes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_chemical_concepts: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          abbreviation: string
          canonical_name: string
          cas_number: string
          chemical_class: string
          chemical_id: string
          commercial_product_names: string[]
          synonyms: string[]
        }[]
      }
      search_patents: {
        Args: {
          p_ai_analyzed_only?: boolean
          p_application_category_ids?: string[]
          p_archived?: boolean
          p_chemical_ids?: string[]
          p_country_codes?: string[]
          p_cursor_id?: string
          p_cursor_uploaded_at?: string
          p_favorite_only?: boolean
          p_limit?: number
          p_query?: string
          p_technical_purpose_ids?: string[]
        }
        Returns: {
          ai_analysis_status: string
          application_names: string[]
          archived: boolean
          assignee: string
          country_code: string
          favorite: boolean
          id: string
          material_names: string[]
          patent_number: string
          publication_date: string
          summary: string
          technical_purpose_names: string[]
          title: string
          uploaded_at: string
        }[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
