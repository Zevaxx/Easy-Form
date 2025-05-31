import { Either, right } from '@sweet-monads/either';

type FailedMessage = {
	message: string;
};

type ValueValidator<R> = (value: R) => Either<FailedMessage, R>;

type FormTree = Record<string, FormField<any> | FormFieldGroup<any>>;

type IsField<T> = T extends FormField<any> ? true : false;

type IsGroup<T> = T extends FormFieldGroup<infer G> ? G : never;

type PathForKey<K extends string, V> = IsField<V> extends true
	? K
	: IsGroup<V> extends never
	? never
	: `${K}.${Path<IsGroup<V>>}`;

export type Path<T extends FormTree> = {
	[K in Extract<keyof T, string>]: PathForKey<K, T[K]>;
}[Extract<keyof T, string>];

type ExtractGroup<T> = T extends FormFieldGroup<infer G> ? G : never;

type ExtractValue<T> = T extends FormField<infer V> ? V : never;

type PathValue<
	T extends FormTree,
	P extends string
> = P extends `${infer Head}.${infer Tail}`
	? Head extends keyof T
		? PathValue<ExtractGroup<T[Head]>, Tail>
		: never
	: P extends keyof T
	? T[P] extends FormField<any>
		? ExtractValue<T[P]>
		: never
	: never;

abstract class FormBase<T extends FormTree> {
	protected constructor(protected fields: T) {}

	protected abstract createInstance(fields: T): FormBase<T>;

	getValueByPath = <P extends Path<T>>(path: P): PathValue<T, P> => {
		const pathArray = path.split('.');
		return this.getNestedValue(this.fields, pathArray);
	};

	private getNestedValue = <Obj extends FormTree, R>(
		obj: Obj,
		path: string[]
	): R => {
		if (path.length === 0) throw new Error('Invalid path: empty path');

		const [head, ...tail] = path;
		if (!(head in obj))
			throw new Error(`Invalid path: key '${head}' not found`);

		const current = obj[head];

		if (current instanceof FormField) {
			if (tail.length === 0) return current.getValue();
			throw new Error(`Cannot traverse deeper into FormField at ${head}`);
		}

		if (current instanceof FormFieldGroup) {
			return this.getNestedValue(current.getFields(), tail);
		}

		return this.getNestedValue(current, tail);
	};

	protected internalSetValueByPath = <P extends Path<T>>(
		path: P,
		newValue: PathValue<T, P>
	): FormBase<T> => {
		const pathArray = path.split('.');
		const updatedFields = this.updateNestedField(
			this.fields,
			pathArray,
			newValue
		);
		return this.createInstance(updatedFields);
	};

	private updateNestedField = <Obj extends FormTree, P extends Path<Obj>>(
		obj: Obj,
		path: string[],
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
					[key]: new FormField(newValue, current['validators']),
				};
			}
			throw new Error(`Cannot traverse deeper into FormField at ${head}`);
		}

		if (current instanceof FormFieldGroup) {
			return {
				...obj,
				[key]: current.internalSetValueByPath(tail.join('.'), newValue),
			};
		}

		throw new Error(`Unsupported field type at path: ${head}`);
	};
}

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
}

class FormFieldGroup<T extends FormTree> extends FormBase<T> {
	private groupValidators: ValueValidator<T>[];

	constructor(
		fields: T,
		groupValidators: ValueValidator<T>[] | ValueValidator<T> = []
	) {
		super(fields);
		this.groupValidators = Array.isArray(groupValidators)
			? groupValidators
			: [groupValidators];
	}

	getFields = (): T => this.fields;

	validateGroup = (): Either<FailedMessage, T> => {
		const fieldValidations = Object.values(this.fields).reduce<
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

		const groupValidations = this.groupValidators.reduce<
			Either<FailedMessage, T>
		>(
			(acc, validator) => acc.chain(() => validator(this.fields)),
			right(this.fields)
		);

		return fieldValidations.chain(() => groupValidations);
	};

	createInstance(formFields: T): FormFieldGroup<T> {
		return new FormFieldGroup(formFields, this.groupValidators);
	}
}

class Form<T extends FormTree> extends FormBase<T> {
	private formValidators: ValueValidator<T>[];

	constructor(
		fields: T,
		formValidators: ValueValidator<T>[] | ValueValidator<T> = []
	) {
		super(fields);
		this.formValidators = Array.isArray(formValidators)
			? formValidators
			: [formValidators];
	}

	getForm = (): T => this.fields;

	validateForm = (): Either<FailedMessage, T> => {
		const fieldValidations = Object.values(this.fields).reduce<
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

		const formValidations = this.formValidators.reduce<
			Either<FailedMessage, T>
		>(
			(acc, validator) => acc.chain(() => validator(this.fields)),
			right(this.fields)
		);

		return fieldValidations.chain(() => formValidations);
	};

	setValueByPath = <P extends Path<T>>(
		path: P,
		newValue: PathValue<T, P>
	): Form<T> => {
		const updatedForm = this.internalSetValueByPath(path, newValue);
		return new Form(updatedForm['fields'], this.formValidators);
	};

	protected createInstance(fields: T): FormBase<T> {
		return new Form(fields, this.formValidators);
	}
}

export { Form, FormField, FormFieldGroup };
