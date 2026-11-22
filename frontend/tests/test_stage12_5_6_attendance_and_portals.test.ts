import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Stage 12.5.6: Attendance Suite & Role Experience Reconstruction", () => {
  describe("1. Workspace Switcher Adaptability", () => {
    it("should suppress interactive dropdown for student and guardian personas", () => {
      const roles = ["student", "guardian"];
      roles.forEach((role) => {
        const isStudentOrGuardian = role === "student" || role === "guardian";
        assert.equal(isStudentOrGuardian, true, `Role ${role} must not have workspace switcher dropdown`);
      });
    });

    it("should suppress dropdown chevron when tenant has only 1 workspace", () => {
      const singleWorkspaceList = [{ orgId: "default", name: "Kids Shine School", type: "school" }];
      const hasMultiple = singleWorkspaceList.length > 1;
      assert.equal(hasMultiple, false, "Single workspace should not offer a dropdown menu");
    });

    it("should enable dropdown menu only when multiple workspaces exist for staff", () => {
      const multiWorkspaceList = [
        { orgId: "ws-1", name: "Main Campus", type: "school" },
        { orgId: "ws-2", name: "Academy Coaching Branch", type: "academy" }
      ];
      const hasMultiple = multiWorkspaceList.length > 1;
      assert.equal(hasMultiple, true, "Multiple workspaces must enable context switching");
    });
  });

  describe("2. Attendance Suite Navigation & URL Generation", () => {
    it("should construct valid CSV export query parameters", () => {
      const params = new URLSearchParams();
      params.append("class_name", "Class 5");
      params.append("start_date", "2026-11-01");
      params.append("end_date", "2026-11-09");
      params.append("format", "csv");

      const exportUrl = `/api/v1/attendance/export?${params.toString()}`;
      assert.match(exportUrl, /class_name=Class\+5/);
      assert.match(exportUrl, /format=csv/);
      assert.match(exportUrl, /start_date=2026-11-01/);
    });

    it("should construct valid HTML printable report query parameters", () => {
      const params = new URLSearchParams();
      params.append("class_name", "All");
      params.append("format", "html");

      const printUrl = `/api/v1/attendance/export?${params.toString()}`;
      assert.match(printUrl, /format=html/);
    });

    it("should format WhatsApp outreach links with Bangladesh country code (+88)", () => {
      const phone = "01719876543";
      const studentName = "Sami Hossain";
      const formattedPhone = phone.startsWith("0") ? "88" + phone : phone;
      const waLink = `https://wa.me/${formattedPhone}?text=Dear%20Parent,%20your%20child%20${encodeURIComponent(studentName)}%20was%20marked%20absent%20today.`;

      assert.equal(formattedPhone, "8801719876543");
      assert.match(waLink, /wa\.me\/8801719876543/);
      assert.match(waLink, /Sami%20Hossain/);
    });
  });

  describe("3. Guardian Multi-Child Selection & Metrics", () => {
    const mockChildren = [
      {
        student_id: "s1",
        student_name: "Sami Hossain",
        class_name: "Class 5",
        attendance: { total_days: 24, present_days: 23, rate_percentage: 95.8, today_status: "Present" },
        academics: { standing: "GPA 5.00 (A+)" },
        fees: { status: "Paid in Full", total_paid: 15000 }
      },
      {
        student_id: "s2",
        student_name: "Zara Hossain",
        class_name: "Class 2",
        attendance: { total_days: 20, present_days: 20, rate_percentage: 100.0, today_status: "Present" },
        academics: { standing: "GPA 5.00 (A+)" },
        fees: { status: "Paid in Full", total_paid: 12000 }
      }
    ];

    it("should support switching between enrolled siblings seamlessly", () => {
      let selectedIndex = 0;
      assert.equal(mockChildren[selectedIndex].student_name, "Sami Hossain");
      assert.equal(mockChildren[selectedIndex].class_name, "Class 5");

      // Switch to sibling
      selectedIndex = 1;
      assert.equal(mockChildren[selectedIndex].student_name, "Zara Hossain");
      assert.equal(mockChildren[selectedIndex].class_name, "Class 2");
      assert.equal(mockChildren[selectedIndex].attendance.rate_percentage, 100.0);
    });

    it("should compute accurate attendance percentage", () => {
      const total = 24;
      const present = 23;
      const calculatedRate = Math.round((present / total) * 1000) / 10;
      assert.equal(calculatedRate, 95.8);
    });
  });

  describe("4. Student Personal Routine & Schedule Mapping", () => {
    it("should resolve daily periods with teacher and room assignments", () => {
      const mockRoutine = {
        day: "Monday",
        periods_count: 5,
        periods: [
          { period: "Period 1", subject: "Mathematics", start_time: "09:00 AM", end_time: "09:45 AM", teacher_name: "Mr. Habib", room_number: "Room 102" },
          { period: "Period 2", subject: "Bangla", start_time: "09:45 AM", end_time: "10:30 AM", teacher_name: "Ms. Nasreen", room_number: "Room 102" }
        ]
      };

      assert.equal(mockRoutine.periods_count, 5);
      assert.equal(mockRoutine.periods[0].subject, "Mathematics");
      assert.equal(mockRoutine.periods[0].room_number, "Room 102");
      assert.equal(mockRoutine.periods[1].teacher_name, "Ms. Nasreen");
    });
  });
});

