package model

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type TaskFunc func()

type ScheduledTask struct {
	Name                 string        `json:"name"`
	Interval             time.Duration `json:"interval"`
	Recurring            bool          `json:"recurring"`
	function             TaskFunc
	cancelled            chan struct{}
	fromNextIntervalTime bool
	ctx                  context.Context
	cancelFunc           context.CancelFunc
	mu                   sync.Mutex
}

// Public constructors
func CreateTask(name string, function TaskFunc, timeToExecution time.Duration) *ScheduledTask {
	return createTaskWithContext(context.Background(), name, function, timeToExecution, false, false)
}

func CreateRecurringTask(name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTaskWithContext(context.Background(), name, function, interval, true, false)
}

func CreateRecurringTaskFromNextIntervalTime(name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTaskWithContext(context.Background(), name, function, interval, true, true)
}

func CreateTaskWithContext(ctx context.Context, name string, function TaskFunc, timeToExecution time.Duration) *ScheduledTask {
	return createTaskWithContext(ctx, name, function, timeToExecution, false, false)
}

func CreateRecurringTaskWithContext(ctx context.Context, name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTaskWithContext(ctx, name, function, interval, true, false)
}

func CreateRecurringTaskFromNextIntervalTimeWithContext(ctx context.Context, name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTaskWithContext(ctx, name, function, interval, true, true)
}

// Core creation logic
func createTaskWithContext(ctx context.Context, name string, function TaskFunc, interval time.Duration, recurring bool, fromNextIntervalTime bool) *ScheduledTask {
	taskCtx, cancelFunc := context.WithCancel(ctx)
	task := &ScheduledTask{
		Name:                 name,
		Interval:             interval,
		Recurring:            recurring,
		function:             function,
		cancelled:            make(chan struct{}),
		fromNextIntervalTime: fromNextIntervalTime,
		ctx:                  taskCtx,
		cancelFunc:           cancelFunc,
	}

	go func() {
		defer close(task.cancelled)
		defer cancelFunc()

		var firstTick <-chan time.Time
		var tickerCh <-chan time.Time

		if fromNextIntervalTime {
			curr := time.Now()
			first := curr.Truncate(interval)
			if first.Before(curr) {
				first = first.Add(interval)
			}
			firstTick = time.After(time.Until(first))
		} else {
			ticker := time.NewTicker(interval)
			tickerCh = ticker.C
			defer ticker.Stop()
		}

		for {
			select {
			case <-firstTick:
				firstTick = nil
				if tickerCh == nil {
					ticker := time.NewTicker(interval)
					tickerCh = ticker.C
					defer ticker.Stop()
				}
				safeRun(function, name)
			case <-tickerCh:
				safeRun(function, name)
			case <-taskCtx.Done():
				return
			}
			if !recurring {
				return
			}
		}
	}()

	return task
}

// Cancel stops the task
func (task *ScheduledTask) Cancel() {
	task.mu.Lock()
	defer task.mu.Unlock()
	task.cancelFunc()
	<-task.cancelled
}

// String representation
func (task *ScheduledTask) String() string {
	return fmt.Sprintf(
		"%s\nInterval: %s\nRecurring: %t\n",
		task.Name,
		task.Interval.String(),
		task.Recurring,
	)
}

// Panic-safe wrapper
func safeRun(fn TaskFunc, name string) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("Task %s panicked: %v\n", name, r)
		}
	}()
	fn()
}
