"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchWithTenant } from "./api-client";

export type AcademicTier =
  | "pre_primary"
  | "primary"
  | "junior_secondary"
  | "secondary"
  | "higher_secondary";

export interface AcademicClass {
  class_name: string;
  name_bn: string;
  grade_numeric: number;
  tier: AcademicTier;
  supported_groups: string[];
  supported_shifts: string[];
  default_sections: string[];
}

export const CANONICAL_FALLBACK_CLASSES: AcademicClass[] = [
  {
    class_name: "Play",
    name_bn: "প্লে",
    grade_numeric: 0,
    tier: "pre_primary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "Rose"],
  },
  {
    class_name: "Nursery",
    name_bn: "নার্সারি",
    grade_numeric: 0,
    tier: "pre_primary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "Lotus"],
  },
  {
    class_name: "KG",
    name_bn: "কেজি",
    grade_numeric: 0,
    tier: "pre_primary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "Tulip"],
  },
  {
    class_name: "Class 1",
    name_bn: "প্রথম শ্রেণি",
    grade_numeric: 1,
    tier: "primary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "B"],
  },
  {
    class_name: "Class 2",
    name_bn: "দ্বিতীয় শ্রেণি",
    grade_numeric: 2,
    tier: "primary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "B"],
  },
  {
    class_name: "Class 3",
    name_bn: "তৃতীয় শ্রেণি",
    grade_numeric: 3,
    tier: "primary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "B"],
  },
  {
    class_name: "Class 4",
    name_bn: "চতুর্থ শ্রেণি",
    grade_numeric: 4,
    tier: "primary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "B"],
  },
  {
    class_name: "Class 5",
    name_bn: "পঞ্চম শ্রেণি",
    grade_numeric: 5,
    tier: "primary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "B"],
  },
  {
    class_name: "Class 6",
    name_bn: "ষষ্ঠ শ্রেণি",
    grade_numeric: 6,
    tier: "junior_secondary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "B", "C"],
  },
  {
    class_name: "Class 7",
    name_bn: "সপ্তম শ্রেণি",
    grade_numeric: 7,
    tier: "junior_secondary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "B", "C"],
  },
  {
    class_name: "Class 8",
    name_bn: "অষ্টম শ্রেণি",
    grade_numeric: 8,
    tier: "junior_secondary",
    supported_groups: [],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "B", "C"],
  },
  {
    class_name: "Class 9",
    name_bn: "নবম শ্রেণি",
    grade_numeric: 9,
    tier: "secondary",
    supported_groups: ["Science", "Humanities", "Business Studies"],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "B", "Science-A", "Commerce-A"],
  },
  {
    class_name: "Class 10",
    name_bn: "দশম শ্রেণি",
    grade_numeric: 10,
    tier: "secondary",
    supported_groups: ["Science", "Humanities", "Business Studies"],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["A", "B", "Science-A", "Commerce-A"],
  },
  {
    class_name: "Class 11",
    name_bn: "একাদশ শ্রেণি",
    grade_numeric: 11,
    tier: "higher_secondary",
    supported_groups: ["Science", "Humanities", "Business Studies"],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["Science-1", "Arts-1", "Commerce-1"],
  },
  {
    class_name: "Class 12",
    name_bn: "দ্বাদশ শ্রেণি",
    grade_numeric: 12,
    tier: "higher_secondary",
    supported_groups: ["Science", "Humanities", "Business Studies"],
    supported_shifts: ["Morning", "Day"],
    default_sections: ["Science-1", "Arts-1", "Commerce-1"],
  },
];

export function useAcademicClasses() {
  const [classes, setClasses] = useState<AcademicClass[]>(CANONICAL_FALLBACK_CLASSES);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState<boolean>(false);

  const loadData = useCallback(async (isInitial = false) => {
    if (!isInitial) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetchWithTenant("/api/v1/academic/classes");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setClasses(data);
          setIsFallback(false);
          return;
        }
      }
      // If endpoint returns empty or fails gracefully, use canonical Class 1-12 fallback
      setClasses(CANONICAL_FALLBACK_CLASSES);
      setIsFallback(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load academic classes.";
      console.warn("useAcademicClasses: Network request failed, using canonical catalogue fallback.", err);
      setError(msg);
      setClasses(CANONICAL_FALLBACK_CLASSES);
      setIsFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetchWithTenant("/api/v1/academic/classes");
        if (ignore) return;
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setClasses(data);
            setIsFallback(false);
            return;
          }
        }
        setClasses(CANONICAL_FALLBACK_CLASSES);
        setIsFallback(true);
      } catch (err: unknown) {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : "Failed to load academic classes.";
        console.warn("useAcademicClasses: Network request failed, using canonical catalogue fallback.", err);
        setError(msg);
        setClasses(CANONICAL_FALLBACK_CLASSES);
        setIsFallback(true);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      ignore = true;
    };
  }, []);

  const fetchClasses = useCallback(async () => {
    await loadData(false);
  }, [loadData]);

  const classNames = useMemo(() => classes.map((c) => c.class_name), [classes]);

  const getClassByName = useCallback(
    (name: string): AcademicClass | undefined => {
      return classes.find(
        (c) => c.class_name.toLowerCase() === (name || "").toLowerCase()
      );
    },
    [classes]
  );

  const getGroupsForClass = useCallback(
    (name: string): string[] => {
      const item = getClassByName(name);
      return item?.supported_groups || [];
    },
    [getClassByName]
  );

  return {
    classes,
    classNames,
    loading,
    error,
    isFallback,
    refetch: fetchClasses,
    getClassByName,
    getGroupsForClass,
  };
}

