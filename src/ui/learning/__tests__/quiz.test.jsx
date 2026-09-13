import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerForQuestion, createQuizRound, QUIZ_QUESTIONS } from '../quizCatalog.js';
import RuleQuizScreen from '../RuleQuizScreen.jsx';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
describe('quiz answers verified independently of engine output', () => {
  const expected = ['left', 'right', 'left', 'right', 'right', 'right', 'left', 'right', 'tie', 'tie', '4', '1', '3', '3', '2', '4', 'yes', 'yes', 'no', 'no', 'no', 'yes'];
  it.each(QUIZ_QUESTIONS.map((question, i) => [question.id, question, expected[i]]))('%s has the reviewed answer', (_id, question, answer) => {
    expect(answerForQuestion(question)).toBe(answer);
  });
  it('deals six distinct questions without modifying the question bank', () => {
    const ids = QUIZ_QUESTIONS.map(q => q.id);
    const round = createQuizRound('lowball', () => 0.4);
    expect(round).toHaveLength(6);
    expect(new Set(round.map(q => q.id)).size).toBe(6);
    expect(QUIZ_QUESTIONS.map(q => q.id)).toEqual(ids);
  });
  it('locks answers, scores the round, and retries only mistakes', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    render(<MemoryRouter initialEntries={['/learn/quiz?topic=badugi']}><RuleQuizScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '1枚' }));
    expect(screen.getByRole('button', { name: '4枚' }).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正解：4枚');
    expect(document.activeElement).toBe(screen.getByRole('status'));
    fireEvent.click(screen.getByRole('button', { name: '次の問題' }));
    for (const [i, choice] of ['1枚', '3枚', '3枚', '2枚', '4枚'].entries()) {
      fireEvent.click(screen.getByRole('button', { name: choice }));
      fireEvent.click(screen.getByRole('button', { name: i === 4 ? '結果を見る' : '次の問題' }));
    }
    expect(screen.getByText('5 / 6')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '間違えた問題だけ復習' }));
    expect(screen.getByText('1 / 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '4枚' }));
    fireEvent.click(screen.getByRole('button', { name: '結果を見る' }));
    expect(screen.queryByRole('button', { name: '間違えた問題だけ復習' })).toBeNull();
  });
});
