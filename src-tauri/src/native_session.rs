use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stage {
    pub duration: u64,
    pub stage_name: String,
    pub color: String,
    pub context: String,
    pub voice: bool,
    pub notifications: bool,
}

#[derive(Clone, Deserialize)]
pub struct Finish {
    pub title: String,
    pub body: String,
    pub voice: bool,
    pub notifications: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInput {
    pub id: String,
    pub stages: Vec<Stage>,
    pub index: usize,
    pub remaining: f64,
    pub finish: Finish,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: String,
    pub index: usize,
    pub remaining: f64,
    pub running: bool,
    pub finished: bool,
    pub stage_name: String,
    pub color: String,
    pub widget_enabled: bool,
    pub widget_visible: bool,
}

pub enum Transition {
    Stage(Stage),
    Finish(Finish),
}

pub struct Session {
    pub id: String,
    pub stages: Vec<Stage>,
    pub finish: Finish,
    pub index: usize,
    pub remaining_ms: u64,
    pub deadline: Option<Instant>,
    pub running: bool,
    pub finished: bool,
    pub announced: bool,
}

impl Session {
    pub fn new(input: SessionInput, now: Instant) -> Result<Self, String> {
        if input.id.is_empty()
            || input.stages.is_empty()
            || input.index >= input.stages.len()
            || input.stages.iter().any(|step| step.duration == 0)
            || !input.remaining.is_finite()
        {
            return Err("Sesión inválida".into());
        }
        let max_ms = input.stages[input.index].duration.saturating_mul(1000);
        let remaining_ms = (input.remaining * 1000.0).round().max(0.0) as u64;
        if remaining_ms > max_ms {
            return Err("Tiempo restante inválido".into());
        }
        Ok(Self {
            id: input.id,
            stages: input.stages,
            finish: input.finish,
            index: input.index,
            remaining_ms,
            deadline: Some(now + Duration::from_millis(remaining_ms)),
            running: true,
            finished: false,
            announced: true,
        })
    }

    pub fn remaining_ms(&self, now: Instant) -> u64 {
        self.deadline
            .map(|deadline| deadline.saturating_duration_since(now).as_millis() as u64)
            .unwrap_or(self.remaining_ms)
    }

    pub fn snapshot(&self, now: Instant, enabled: bool, visible: bool) -> Snapshot {
        let step = &self.stages[self.index];
        Snapshot {
            id: self.id.clone(),
            index: self.index,
            remaining: self.remaining_ms(now) as f64 / 1000.0,
            running: self.running,
            finished: self.finished,
            stage_name: step.stage_name.clone(),
            color: step.color.clone(),
            widget_enabled: enabled,
            widget_visible: visible,
        }
    }

    pub fn control(&mut self, action: &str, now: Instant) -> Result<Option<Transition>, String> {
        match action {
            "pause" if self.running => {
                self.remaining_ms = self.remaining_ms(now);
                self.deadline = None;
                self.running = false;
                Ok(None)
            }
            "resume" if !self.running => {
                if self.finished {
                    self.reset();
                }
                self.running = true;
                self.deadline = Some(now + Duration::from_millis(self.remaining_ms));
                let announce = !self.announced;
                self.announced = true;
                Ok(announce.then(|| Transition::Stage(self.stages[self.index].clone())))
            }
            "next" | "previous" => {
                self.index = if action == "next" {
                    (self.index + 1).min(self.stages.len() - 1)
                } else {
                    self.index.saturating_sub(1)
                };
                self.remaining_ms = self.stages[self.index].duration.saturating_mul(1000);
                self.finished = false;
                self.deadline = self
                    .running
                    .then(|| now + Duration::from_millis(self.remaining_ms));
                self.announced = self.running;
                Ok(self
                    .running
                    .then(|| Transition::Stage(self.stages[self.index].clone())))
            }
            "reset" => {
                self.reset();
                Ok(None)
            }
            "pause" | "resume" => Ok(None),
            _ => Err("Control desconocido".into()),
        }
    }

    fn reset(&mut self) {
        self.index = 0;
        self.remaining_ms = self.stages[0].duration.saturating_mul(1000);
        self.deadline = None;
        self.running = false;
        self.finished = false;
        self.announced = false;
    }

    /// If Windows resumes late, return only the most recent stage or the final notice.
    pub fn advance(&mut self, now: Instant) -> Option<Transition> {
        if !self.running {
            return None;
        }
        let mut latest = None;
        while let Some(deadline) = self.deadline {
            if deadline > now {
                break;
            }
            if self.index + 1 == self.stages.len() {
                self.remaining_ms = 0;
                self.deadline = None;
                self.running = false;
                self.finished = true;
                return Some(Transition::Finish(self.finish.clone()));
            }
            self.index += 1;
            self.remaining_ms = self.stages[self.index].duration.saturating_mul(1000);
            self.deadline = Some(deadline + Duration::from_millis(self.remaining_ms));
            self.announced = true;
            latest = Some(Transition::Stage(self.stages[self.index].clone()));
        }
        latest
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stage(name: &str, duration: u64) -> Stage {
        Stage {
            duration,
            stage_name: name.into(),
            color: "gray".into(),
            context: String::new(),
            voice: true,
            notifications: true,
        }
    }
    fn session(now: Instant) -> Session {
        Session::new(
            SessionInput {
                id: "one".into(),
                stages: vec![stage("A", 1), stage("B", 2), stage("C", 1)],
                index: 0,
                remaining: 1.0,
                finish: Finish {
                    title: "Fin".into(),
                    body: String::new(),
                    voice: true,
                    notifications: true,
                },
            },
            now,
        )
        .unwrap()
    }
    #[test]
    fn jumps_cross_stages_and_keep_pause() {
        let now = Instant::now();
        let mut s = session(now);
        s.control("pause", now + Duration::from_millis(400))
            .unwrap();
        assert!(!s.running);
        s.control("next", now).unwrap();
        assert_eq!(s.index, 1);
        assert_eq!(s.remaining_ms, 2000);
        assert!(s.control("resume", now).unwrap().is_some());
        s.control("previous", now).unwrap();
        assert_eq!(s.index, 0);
        assert_eq!(s.remaining_ms, 1000);
        assert!(s.running);
    }
    #[test]
    fn catches_up_without_announcing_old_stages() {
        let now = Instant::now();
        let mut s = session(now);
        let event = s.advance(now + Duration::from_millis(2500));
        assert!(matches!(event, Some(Transition::Stage(step)) if step.stage_name == "B"));
        assert_eq!(s.index, 1);
        assert!(matches!(
            s.advance(now + Duration::from_millis(4500)),
            Some(Transition::Finish(_))
        ));
        assert!(s.advance(now + Duration::from_secs(8)).is_none());
    }
}
