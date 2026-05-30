export type Todo = {
  id: string;
  title: string;
  memo: string | null;
  due_date: string;          // YYYY-MM-DD
  due_time: string | null;   // HH:mm:ss
  priority: number;          // 0..5
  done: boolean;
  notified: boolean;
};

export type Deadline = {
  id: string;
  title: string;
  memo: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  priority: number;
  done: boolean;
  notified: boolean;
};

export type Goal = {
  id: string;
  title: string;
  memo: string | null;
  target_date: string | null;
};

export type SubGoal = {
  id: string;
  goal_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
};
