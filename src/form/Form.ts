import { Either, right } from '@sweet-monads/either';

type FailedMessage = {
	message: string;
};

type ValueValidator<R> = (value: R) => Either<FailedMessage, R>;

type FormFieldValueType<F> = F extends FormField<infer R>
	? R
	: F extends FormFieldGroup<infer G>
	? G
	: never;

type FormTree = Record<string, FormField<any> | FormFieldGroup<any>>;

class FormField<R> {
	private validators: ValueValidator<R>[];

	constructor(
		private value: R,
		validators: ValueValidator<R>[] | ValueValidator<R> = []
	) {
		this.validators = Array.isArray(validators) ? validators : [validators];
	}

	getValue = (): R => this.value;

	validate = (): Either<FailedMessage, R> =>
		this.validators.reduce<Either<FailedMessage, R>>(
			(acc, validator) => acc.chain(validator),
			right(this.value)
		);

	setNewValue = (newValue: R): FormField<R> =>
		new FormField(newValue, this.validators);
}

class FormFieldGroup<T extends FormTree> {
	private groupValidators: ValueValidator<T>[];

	constructor(
		private fields: T,
		groupValidators: ValueValidator<T>[] | ValueValidator<T> = []
	) {
		this.groupValidators = Array.isArray(groupValidators)
			? groupValidators
			: [groupValidators];
	}

	getFields = (): T => this.fields;

	validateGroup = (): Either<FailedMessage, T> => {
		const fieldValidationResults = Object.values(this.fields).reduce<
			Either<FailedMessage, T>
		>(
			(acc, field) =>
				acc.chain(() =>
					field instanceof FormField
						? field.validate().map(() => this.fields)
						: field instanceof FormFieldGroup
						? field.validateGroup().map(() => this.fields)
						: right(this.fields)
				),
			right(this.fields)
		);
		const groupValidationResult = this.groupValidators.reduce<
			Either<FailedMessage, T>
		>(
			(acc, validator) => acc.chain(() => validator(this.fields)),
			right(this.fields)
		);
		return fieldValidationResults.chain(() => groupValidationResult);
	};

	setNewValue = <K extends keyof T>(
		fieldName: K,
		newValue: FormFieldValueType<T[K]>
	): FormFieldGroup<T> => {
		const currentField = this.fields[fieldName];

		let updatedField: T[K];

		if (currentField instanceof FormField) {
			updatedField = currentField.setNewValue(newValue) as T[K];
		} else if (currentField instanceof FormFieldGroup) {
			// This case needs more specific handling based on your requirements
			throw new Error(
				'Cannot directly set value on FormFieldGroup. Use setValueByPath instead.'
			);
		} else {
			throw new Error(`Unsupported field type for ${String(fieldName)}`);
		}

		return new FormFieldGroup(
			{
				...this.fields,
				[fieldName]: updatedField,
			},
			this.groupValidators
		);
	};
}

type Path<T extends FormTree> = {
	[K in keyof T]: T[K] extends FormField<any>
		? `${K & string}`
		: T[K] extends FormFieldGroup<infer G>
		? `${K & string}.${Path<G>}`
		: never;
}[keyof T];

type PathValue<
	T extends FormTree,
	P extends string
> = P extends `${infer Head}.${infer Tail}`
	? Head extends keyof T
		? T[Head] extends FormFieldGroup<infer G>
			? PathValue<G, Tail>
			: never
		: never
	: P extends keyof T
	? T[P] extends FormField<infer V>
		? V
		: T[P] extends FormFieldGroup<infer G>
		? G
		: never
	: never;

class Form<T extends FormTree> {
	private formValidators: ValueValidator<T>[];

	constructor(
		private fields: T,
		formValidators: ValueValidator<T>[] | ValueValidator<T> = []
	) {
		this.formValidators = Array.isArray(formValidators)
			? formValidators
			: [formValidators];
	}

	getForm = (): T => this.fields;

	validateForm = (): Either<FailedMessage, T> => {
		const fieldValidationResults = Object.values(this.fields).reduce<
			Either<FailedMessage, T>
		>(
			(acc, field) =>
				acc.chain(() =>
					field instanceof FormField
						? field.validate().map(() => this.fields)
						: field instanceof FormFieldGroup
						? field.validateGroup().map(() => this.fields)
						: right(this.fields)
				),
			right(this.fields)
		);
		const formValidationResult = this.formValidators.reduce<
			Either<FailedMessage, T>
		>(
			(acc, validator) => acc.chain(() => validator(this.fields)),
			right(this.fields)
		);
		return fieldValidationResults.chain(() => formValidationResult);
	};

	setValueByPath = <P extends Path<T>>(
		path: P,
		newValue: PathValue<T, P>
	): Form<T> => {
		const pathArray = path.split('.');
		const updatedFields = this.updateNestedFieldTyped(
			this.fields,
			pathArray,
			path,
			newValue
		);
		return new Form(updatedFields, this.formValidators);
	};

	private updateNestedFieldTyped = <
		Obj extends FormTree,
		P extends Path<Obj>
	>(
		obj: Obj,
		path: string[],
		fullPath: P,
		newValue: PathValue<Obj, P>
	): Obj => {
		if (path.length === 0) {
			throw new Error('Invalid path: cannot replace entire object');
		}

		const [head, ...tail] = path;
		if (!(head in obj)) {
			throw new Error(`Invalid path: key '${head}' not found`);
		}

		const key = head as keyof Obj;
		const current = obj[key];

		if (current instanceof FormField) {
			if (tail.length === 0) {
				return {
					...obj,
					[key]: current.setNewValue(newValue),
				};
			}
			throw new Error(`Cannot traverse deeper into FormField at ${head}`);
		}

		if (current instanceof FormFieldGroup) {
			return {
				...obj,
				[key]: current.setNewValue(fullPath, newValue),
			};
		}

		throw new Error(`Unsupported field type at path: ${head}`);
	};

	getValueByPath = <P extends Path<T>>(path: P): PathValue<T, P> => {
		const pathArray = path.split('.');
		return this.getNestedValue(this.fields, pathArray);
	};

	private getNestedValue = <Obj extends FormTree, R>(
		obj: Obj,
		path: string[]
	): R => {
		if (path.length === 0) {
			throw new Error('Invalid path: empty path');
		}

		const [head, ...tail] = path;
		if (!(head in obj)) {
			throw new Error(`Invalid path: key '${head}' not found`);
		}

		const current = obj[head];

		if (current instanceof FormField) {
			if (tail.length === 0) {
				return current.getValue();
			}
			throw new Error(`Cannot traverse deeper into FormField at ${head}`);
		}

		if (current instanceof FormFieldGroup) {
			return this.getNestedValue(current.getFields(), tail);
		}

		return this.getNestedValue(current, tail);
	};
}

export { Form, FormField, FormFieldGroup };
